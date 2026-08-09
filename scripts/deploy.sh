#!/usr/bin/env bash
# Deploy SocietyOps: build images -> push to GHCR -> pull+run on the VM -> run pending migrations.
# Usage: ./scripts/deploy.sh
set -euo pipefail

export PATH="/Users/karthik/google-cloud-sdk/bin:$PATH"

PROJECT="societyops-99801"
ZONE="us-central1-a"
VM="societyops-vm"
VM_IP="136.115.186.144"
DOMAIN="136.115.186.144.nip.io"
GHCR_OWNER="virtualkarthik"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

command -v gcloud >/dev/null || { echo "gcloud not on PATH"; exit 1; }
command -v gh >/dev/null || { echo "gh not on PATH"; exit 1; }
command -v docker >/dev/null || { echo "docker not on PATH"; exit 1; }

GIT_SHA="$(git -C "$REPO_ROOT" rev-parse --short HEAD)"
echo "==> Deploying commit $GIT_SHA"

echo "==> [1/6] Pushing code to GitHub"
git -C "$REPO_ROOT" push origin main

echo "==> [2/6] Logging in to GHCR"
gh auth token | docker login ghcr.io -u "$GHCR_OWNER" --password-stdin

echo "==> [3/6] Building + pushing backend image (linux/amd64)"
docker buildx build --platform linux/amd64 \
  -t "ghcr.io/${GHCR_OWNER}/societyops-backend:latest" \
  -t "ghcr.io/${GHCR_OWNER}/societyops-backend:${GIT_SHA}" \
  --push "$REPO_ROOT/backend"

echo "==> [4/6] Building + pushing frontend image (linux/amd64)"
docker buildx build --platform linux/amd64 \
  --build-arg VITE_API_BASE_URL="https://${DOMAIN}" \
  -t "ghcr.io/${GHCR_OWNER}/societyops-frontend:latest" \
  -t "ghcr.io/${GHCR_OWNER}/societyops-frontend:${GIT_SHA}" \
  --push "$REPO_ROOT/frontend"

echo "==> [5/6] Copying compose file + Caddyfile to VM"
gcloud compute scp "$REPO_ROOT/docker-compose.prod.yml" "${VM}:/tmp/docker-compose.prod.yml" \
  --zone "$ZONE" --project "$PROJECT"
gcloud compute scp "$REPO_ROOT/Caddyfile" "${VM}:/tmp/Caddyfile" \
  --zone "$ZONE" --project "$PROJECT"

echo "==> [6/6] Pulling images, restarting containers, and running migrations on the VM"
TOKEN="$(gh auth token)"
gcloud compute ssh "$VM" --zone "$ZONE" --project "$PROJECT" --command "
set -e
echo '$TOKEN' | sudo docker login ghcr.io -u $GHCR_OWNER --password-stdin
sudo cp /tmp/docker-compose.prod.yml /opt/societyops/docker-compose.prod.yml
sudo cp /tmp/Caddyfile /opt/societyops/Caddyfile
cd /opt/societyops
sudo docker compose -f docker-compose.prod.yml pull
sudo docker compose -f docker-compose.prod.yml up -d
sudo docker compose -f docker-compose.prod.yml exec -T societyops-backend alembic upgrade head
sudo docker image prune -f
sudo docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}'
"

echo "==> Health check"
sleep 5
curl -sS -m 10 -o /dev/null -w "frontend: HTTP %{http_code}\n" "https://${DOMAIN}/"
curl -sS -m 10 -o /dev/null -w "backend:  HTTP %{http_code}\n" "https://${DOMAIN}/api/v1/auth/login"

echo "==> Done. Deployed ${GIT_SHA} to https://${DOMAIN}/"
