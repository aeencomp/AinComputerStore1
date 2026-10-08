#!/usr/bin/env bash
# Emergency: site 502 / ain-app down. Run on VPS as user deploy:
#   bash /home/deploy/AinComputerStore/scripts/fix-site-now.sh
set -euo pipefail

APP_DIR="/home/deploy/AinComputerStore"
PM2_NAME="ain-app"

if [ "$(id -un)" != "deploy" ]; then
  echo "Run as deploy: su - deploy -c 'bash $APP_DIR/scripts/fix-site-now.sh'"
  exit 1
fi

cd "$APP_DIR"

if [ ! -f .env ]; then
  echo "ERROR: missing .env"
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

echo "==> Git pull (HTTPS)"
git remote set-url origin https://github.com/aeencomp/AinComputerStore1.git
git fetch --all --prune
git reset --hard origin/main

chmod +x deploy.sh scripts/start-prod.sh 2>/dev/null || true

if [ ! -d node_modules ] || [ ! -f node_modules/.package-lock.json ]; then
  echo "==> npm ci"
  npm ci --no-audit --no-fund
fi

if [ ! -f dist/index.js ] || [ ! -f dist/public/index.html ]; then
  echo "==> npm run build"
  export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=2048}"
  npm run build
fi

echo "==> PM2 restart"
pm2 delete "$PM2_NAME" 2>/dev/null || true
pm2 start ecosystem.config.cjs
pm2 save

PORT="${PORT:-5000}"
echo "==> Health check http://127.0.0.1:${PORT}/api/health"
for i in $(seq 1 20); do
  if curl -sf "http://127.0.0.1:${PORT}/api/health" >/dev/null; then
    echo "OK — site backend is up on port ${PORT}"
    pm2 status
    exit 0
  fi
  sleep 2
done

echo "FAILED — logs:"
pm2 logs "$PM2_NAME" --lines 40 --nostream
exit 1
