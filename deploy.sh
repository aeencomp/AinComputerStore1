#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/home/deploy/AinComputerStore"
PM2_NAME="ain-app"

cd "$APP_DIR"

echo "==> Restore PM2 processes saved before last reboot (no-op if none)"
pm2 resurrect 2>/dev/null || true

echo "==> Pull latest code"
git fetch --all --prune
git reset --hard origin/main

echo "==> Stop PM2 (avoid node_modules locks)"
if pm2 describe "$PM2_NAME" >/dev/null 2>&1; then
  pm2 stop "$PM2_NAME" || true
fi

echo "==> Install dependencies"
if ! npm ci --no-audit --no-fund; then
  echo "==> npm ci failed; removing node_modules and retrying"
  rm -rf node_modules
  npm ci --no-audit --no-fund
fi

echo "==> Build"
npm run build

echo "==> DB migrations run automatically on app startup (server/db-migrations.ts)"

echo "==> Restart PM2"
if pm2 describe "$PM2_NAME" >/dev/null 2>&1; then
  pm2 delete "$PM2_NAME" || true
fi
pm2 start ecosystem.config.cjs

pm2 save
echo "==> PM2 status"
pm2 status

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

echo "==> Wait for app health (up to 90s)"
for i in $(seq 1 30); do
  if curl -sf "http://127.0.0.1:${PORT:-5000}/api/health" >/dev/null 2>&1; then
    echo "==> App is responding on port ${PORT:-5000}"
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "==> WARNING: health check failed — run: pm2 logs $PM2_NAME --lines 80"
    pm2 logs "$PM2_NAME" --lines 30 --nostream || true
    exit 1
  fi
  sleep 3
done

echo "==> Done"

