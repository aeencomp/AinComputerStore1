#!/usr/bin/env bash
# Auto-deploy without GitHub SSH: run every 5 min from deploy crontab.
#   */5 * * * * /home/deploy/AinComputerStore/scripts/vps-pull-deploy-cron.sh >> /home/deploy/deploy-cron.log 2>&1
set -euo pipefail
APP_DIR="/home/deploy/AinComputerStore"
LOG="${HOME}/deploy-cron.log"
cd "$APP_DIR"
git remote set-url origin https://github.com/aeencomp/AinComputerStore1.git 2>/dev/null || true
git fetch origin main -q
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)
if [ "$LOCAL" = "$REMOTE" ]; then
  exit 0
fi
echo "$(date -Is) Deploying ${LOCAL:0:7} -> ${REMOTE:0:7}"
chmod +x ./deploy.sh ./scripts/start-prod.sh 2>/dev/null || true
./deploy.sh >> "$LOG" 2>&1
