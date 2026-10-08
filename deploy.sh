#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/home/deploy/AinComputerStore"
PM2_NAME="ain-app"

cd "$APP_DIR"

if [ ! -f .env ]; then
  echo "ERROR: missing $APP_DIR/.env (DATABASE_URL, SESSION_SECRET, PORT, ...)"
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

echo "==> Node $(node -v) | npm $(npm -v)"
echo "==> Commit $(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
echo "==> PORT=${PORT:-5000}"

echo "==> Pull latest code"
git remote set-url origin https://github.com/aeencomp/AinComputerStore1.git 2>/dev/null || true
git fetch --all --prune
git reset --hard origin/main

echo "==> Install dependencies (keeping app running until build succeeds)"
if ! npm ci --no-audit --no-fund; then
  echo "==> npm ci failed; removing node_modules and retrying"
  rm -rf node_modules
  npm ci --no-audit --no-fund
fi

echo "==> Build"
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=2048}"
npm run build

if [ ! -f dist/index.js ] || [ ! -f dist/public/index.html ]; then
  echo "ERROR: build failed — dist/index.js or dist/public/index.html missing"
  echo "       PM2 was NOT stopped; previous app version may still be running."
  exit 1
fi

mkdir -p uploads
chmod 755 uploads

chmod +x scripts/start-prod.sh 2>/dev/null || true

echo "==> Restart PM2"
pm2 delete "$PM2_NAME" 2>/dev/null || true
pm2 start ecosystem.config.cjs
pm2 save
pm2 status

echo "==> Wait for app health (up to 90s) on port ${PORT:-5000}"
for i in $(seq 1 30); do
  if curl -sf "http://127.0.0.1:${PORT:-5000}/api/health" >/dev/null 2>&1; then
    echo "==> App is responding"
    echo "==> Done"
    exit 0
  fi
  sleep 3
done

echo "ERROR: health check failed — nginx may show 502"
pm2 logs "$PM2_NAME" --lines 40 --nostream || true
exit 1
