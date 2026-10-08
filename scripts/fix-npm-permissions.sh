#!/usr/bin/env bash
# Run once as root when npm fails with EACCES under /home/deploy/AinComputerStore:
#   sudo bash /home/deploy/AinComputerStore/scripts/fix-npm-permissions.sh
set -euo pipefail

APP_DIR="/home/deploy/AinComputerStore"
OWNER="deploy"

if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root: sudo bash $0"
  exit 1
fi

if [ ! -d "$APP_DIR" ]; then
  echo "Missing $APP_DIR"
  exit 1
fi

echo "==> Fixing ownership: $APP_DIR -> ${OWNER}:${OWNER}"
chown -R "${OWNER}:${OWNER}" "$APP_DIR"

echo "==> Done. Now as deploy:"
echo "    su - deploy -c 'cd ~/AinComputerStore && npm ci --no-audit --no-fund && npm run build && pm2 restart ain-app'"
