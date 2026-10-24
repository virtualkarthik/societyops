#!/usr/bin/env bash
# Deploy SocietyOps to one instance: build images -> push to GHCR -> pull+run on the VM -> run pending migrations.
# Usage: ./scripts/deploy.sh <target>     (target = a file in scripts/targets/, e.g. demo, opera)
set -euo pipefail

export PATH="/Users/karthik/google-cloud-sdk/bin:$PATH"

GHCR_OWNER="virtualkarthik"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

TARGET="${1:?usage: $0 <target>  (one of: $(ls "$REPO_ROOT/scripts/targets" | sed 's/\.env$//' | xargs))}"
TARGET_FILE="$REPO_ROOT/scripts/targets/${TARGET}.env"
[[ -f "$TARGET_FILE" ]] || { echo "No such target: $TARGET_FILE"; exit 1; }
# shellcheck source=/dev/null
source "$TARGET_FILE"
REGION="${ZONE%-*}"

command -v gcloud >/dev/null || { echo "gcloud not on PATH"; exit 1; }
command -v gh >/dev/null || { echo "gh not on PATH"; exit 1; }
command -v docker >/dev/null || { echo "docker not on PATH"; exit 1; }

if [[ -n "$(git -C "$REPO_ROOT" status --porcelain)" ]]; then
  echo "Working tree is dirty; commit first so the deployed image matches a git SHA."
  exit 1
fi

VM_IP="$(gcloud compute addresses describe "$ADDRESS" --region "$REGION" --project "$PROJECT" --format='value(address)')"
DOMAIN="${DOMAIN:-${VM_IP}.nip.io}"
GIT_SHA="$(git -C "$REPO_ROOT" rev-parse --short HEAD)"
echo "==> Deploying commit $GIT_SHA to target '$TARGET' ($VM, https://$DOMAIN)"

echo "==> [1/5] Pushing code to GitHub"
git -C "$REPO_ROOT" push origin main

echo "==> [2/5] Logging in to GHCR"
gh auth token | docker login ghcr.io -u "$GHCR_OWNER" --password-stdin

# Images are domain-agnostic (frontend calls /api relatively), so one build per SHA serves every target.
for svc in backend frontend; do
  image="ghcr.io/${GHCR_OWNER}/societyops-${svc}"
  if docker manifest inspect "${image}:${GIT_SHA}" >/dev/null 2>&1; then
    echo "==> [3/5] ${svc} image for ${GIT_SHA} already in GHCR, skipping build"
  else
    echo "==> [3/5] Building + pushing ${svc} image (linux/amd64)"
    docker buildx build --platform linux/amd64 \
      -t "${image}:latest" -t "${image}:${GIT_SHA}" \
      --push "$REPO_ROOT/${svc}"
  fi
done

echo "==> [4/5] Copying compose file + Caddyfile to VM"
gcloud compute scp "$REPO_ROOT/docker-compose.prod.yml" "$REPO_ROOT/Caddyfile" "${VM}:/tmp/" \
  --zone "$ZONE" --project "$PROJECT"

echo "==> [5/5] Pulling images, restarting containers, and running migrations on the VM"
TOKEN="$(gh auth token)"
gcloud compute ssh "$VM" --zone "$ZONE" --project "$PROJECT" --command "
set -e
cd /opt/societyops
set_env() { if sudo grep -q \"^\$1=\" .env; then sudo sed -i \"s|^\$1=.*|\$1=\$2|\" .env; else echo \"\$1=\$2\" | sudo tee -a .env >/dev/null; fi; }
set_env DOMAIN '$DOMAIN'
set_env FRONTEND_ORIGIN 'https://$DOMAIN'
set_env IMAGE_TAG '$GIT_SHA'
echo '$TOKEN' | sudo docker login ghcr.io -u $GHCR_OWNER --password-stdin
sudo cp /tmp/docker-compose.prod.yml /tmp/Caddyfile /opt/societyops/
sudo docker compose -f docker-compose.prod.yml pull
sudo docker compose -f docker-compose.prod.yml up -d --remove-orphans
sudo docker compose -f docker-compose.prod.yml exec -T societyops-backend alembic upgrade head
sudo docker image prune -f
sudo docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}'
"

echo "==> Health check"
for i in $(seq 1 12); do
  code="$(curl -sS -m 10 -o /dev/null -w '%{http_code}' "https://${DOMAIN}/" 2>/dev/null || true)"
  [[ "$code" == "200" ]] && break
  sleep 5
done
curl -sS -m 10 -o /dev/null -w "frontend: HTTP %{http_code}\n" "https://${DOMAIN}/"
curl -sS -m 10 -o /dev/null -w "backend:  HTTP %{http_code}\n" "https://${DOMAIN}/api/v1/auth/login"

echo "==> Done. Deployed ${GIT_SHA} to https://${DOMAIN}/"
