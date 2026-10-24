#!/usr/bin/env bash
# One-time setup of a new SocietyOps instance: static IP, VM, Docker, secrets, backups,
# first deploy, and the society + super_admin bootstrap. Safe to re-run; existing pieces are kept.
# Usage: ./scripts/provision.sh <target>     (target = a file in scripts/targets/, e.g. opera)
set -euo pipefail

export PATH="/Users/karthik/google-cloud-sdk/bin:$PATH"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="${1:?usage: $0 <target>}"
TARGET_FILE="$REPO_ROOT/scripts/targets/${TARGET}.env"
[[ -f "$TARGET_FILE" ]] || { echo "No such target: $TARGET_FILE"; exit 1; }
# shellcheck source=/dev/null
source "$TARGET_FILE"
: "${SOCIETY_NAME:?SOCIETY_NAME must be set in $TARGET_FILE}"
: "${ADMIN_EMAIL:?ADMIN_EMAIL must be set in $TARGET_FILE}"
REGION="${ZONE%-*}"
GC=(--project "$PROJECT")

echo "==> [1/6] Static IP $ADDRESS"
if ! gcloud compute addresses describe "$ADDRESS" --region "$REGION" "${GC[@]}" >/dev/null 2>&1; then
  gcloud compute addresses create "$ADDRESS" --region "$REGION" "${GC[@]}"
fi
VM_IP="$(gcloud compute addresses describe "$ADDRESS" --region "$REGION" "${GC[@]}" --format='value(address)')"
echo "    $VM_IP"

echo "==> [2/6] Daily disk snapshot policy (14-day retention)"
if ! gcloud compute resource-policies describe societyops-daily-snapshot --region "$REGION" "${GC[@]}" >/dev/null 2>&1; then
  gcloud compute resource-policies create snapshot-schedule societyops-daily-snapshot \
    --region "$REGION" --daily-schedule --start-time 20:30 \
    --max-retention-days 14 --on-source-disk-delete keep-auto-snapshots "${GC[@]}"
fi

echo "==> [3/6] VM $VM"
if ! gcloud compute instances describe "$VM" --zone "$ZONE" "${GC[@]}" >/dev/null 2>&1; then
  gcloud compute instances create "$VM" --zone "$ZONE" "${GC[@]}" \
    --machine-type "${MACHINE_TYPE:-e2-small}" \
    --image-family ubuntu-2204-lts --image-project ubuntu-os-cloud \
    --boot-disk-size "${DISK_SIZE_GB:-30}GB" --boot-disk-type pd-balanced \
    --address "$VM_IP" --tags societyops-web \
    --labels "app=societyops,instance=${TARGET}"
  gcloud compute disks add-resource-policies "$VM" --zone "$ZONE" \
    --resource-policies societyops-daily-snapshot "${GC[@]}"
fi

echo "==> [4/6] Waiting for SSH"
for i in $(seq 1 30); do
  gcloud compute ssh "$VM" --zone "$ZONE" "${GC[@]}" --command true >/dev/null 2>&1 && break
  sleep 10
done

echo "==> [5/6] Installing Docker, generating secrets, scheduling DB dumps"
gcloud compute ssh "$VM" --zone "$ZONE" "${GC[@]}" --command '
set -e
if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sudo sh
fi
sudo mkdir -p /opt/societyops/backups
cd /opt/societyops
# Secrets are generated on the VM and never leave it.
if [ ! -f .env ]; then
  sudo tee .env >/dev/null <<EOF
POSTGRES_DB=societyops
POSTGRES_USER=societyops
POSTGRES_PASSWORD=$(openssl rand -hex 24)
SECRET_KEY=$(openssl rand -hex 32)
EOF
  sudo chmod 600 .env
fi
sudo tee /etc/cron.d/societyops-backup >/dev/null <<"EOF"
# Nightly logical DB dump, 14 days kept (disk snapshots cover the rest).
30 2 * * * root cd /opt/societyops && docker compose -f docker-compose.prod.yml exec -T societyops-db pg_dump -U societyops societyops | gzip > backups/societyops-$(date +\%F).sql.gz && find backups -name "*.sql.gz" -mtime +14 -delete
EOF
sudo timedatectl set-timezone Asia/Kolkata
'

echo "==> [6/6] First deploy + bootstrap"
"$REPO_ROOT/scripts/deploy.sh" "$TARGET"

gcloud compute ssh "$VM" --zone "$ZONE" "${GC[@]}" --command "
cd /opt/societyops && sudo docker compose -f docker-compose.prod.yml exec -T societyops-backend \
  python bootstrap_society.py --society '$SOCIETY_NAME' --admin-email '$ADMIN_EMAIL' --admin-name '${ADMIN_NAME:-Administrator}'
"

echo "==> Provisioned '$SOCIETY_NAME' at https://${DOMAIN:-${VM_IP}.nip.io}/"
