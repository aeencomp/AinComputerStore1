#!/usr/bin/env bash
# Run on the VPS when nginx shows 502 after a reboot (app not listening).
set -euo pipefail

APP_DIR="/home/deploy/AinComputerStore"
PM2_NAME="ain-app"

cd "$APP_DIR"

if [ ! -f .env ]; then
  echo "ERROR: missing $APP_DIR/.env (DATABASE_URL, SESSION_SECRET, PORT, ...)"
  exit 1
fi

# shellcheck disable=SC1091
set -a
source .env
set +a

pm2 resurrect 2>/dev/null || true

if [ ! -d dist ] || [ ! -f dist/index.js ]; then
  echo "==> Building (dist missing)"
  npm run build
fi

pm2 delete "$PM2_NAME" 2>/dev/null || true
pm2 start ecosystem.config.cjs
pm2 save

echo "==> Waiting for /api/health on port ${PORT:-5000}"
for i in $(seq 1 30); do
  if curl -sf "http://127.0.0.1:${PORT:-5000}/api/health" >/dev/null; then
    echo "OK — app is up"
    pm2 status
    exit 0
  fi
  sleep 3
done

echo "FAILED — recent logs:"
pm2 logs "$PM2_NAME" --lines 50 --nostream
exit 1
