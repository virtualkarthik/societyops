#!/usr/bin/env bash
# Configure outgoing email (forgot-password) on an instance. Prompts for the SMTP
# password without echoing it and writes it straight into the VM's .env, so the
# secret never lands in shell history, git, or chat logs.
# Usage: ./scripts/set-smtp.sh <target>
# Gmail: host smtp.gmail.com, port 587, user = the Gmail address,
#        password = a 16-character App Password (Google Account > Security >
#        2-Step Verification > App passwords). Your normal password won't work.
set -euo pipefail

export PATH="/Users/karthik/google-cloud-sdk/bin:$PATH"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="${1:?usage: $0 <target>}"
# shellcheck source=/dev/null
source "$REPO_ROOT/scripts/targets/${TARGET}.env"

read -r -p "SMTP host [smtp.gmail.com]: " SMTP_HOST; SMTP_HOST="${SMTP_HOST:-smtp.gmail.com}"
read -r -p "SMTP port [587]: " SMTP_PORT; SMTP_PORT="${SMTP_PORT:-587}"
read -r -p "SMTP username (e.g. you@gmail.com): " SMTP_USER
read -r -s -p "SMTP password / App Password (hidden): " SMTP_PASSWORD; echo
SMTP_PASSWORD="${SMTP_PASSWORD// /}"  # Google shows app passwords in groups of 4
read -r -p "From address [$SMTP_USER]: " SMTP_FROM; SMTP_FROM="${SMTP_FROM:-$SMTP_USER}"
[[ -n "$SMTP_USER" && -n "$SMTP_PASSWORD" ]] || { echo "Username and password are required"; exit 1; }

# The values travel over gcloud's SSH channel on stdin, not on the command line.
printf '%s\n' "SMTP_HOST=$SMTP_HOST" "SMTP_PORT=$SMTP_PORT" "SMTP_USER=$SMTP_USER" \
  "SMTP_PASSWORD=$SMTP_PASSWORD" "SMTP_FROM=$SMTP_FROM" |
gcloud compute ssh "$VM" --zone "$ZONE" --project "$PROJECT" --command '
set -e
cd /opt/societyops
while IFS= read -r line; do
  key="${line%%=*}"
  sudo sed -i "/^${key}=/d" .env
  printf "%s\n" "$line" | sudo tee -a .env >/dev/null
done
sudo docker compose -f docker-compose.prod.yml up -d societyops-backend >/dev/null 2>&1
echo "SMTP settings saved; backend restarted."
'
echo "Test it: open the login page, tap 'Forgot password?', and enter your email."
