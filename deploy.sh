#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/home/deploy/AinComputerStore"
PM2_NAME="ain-app"

cd "$APP_DIR"

echo "==> Pull latest code"
git fetch --all --prune
git reset --hard origin/main

echo "==> Install dependencies"
npm ci

echo "==> Build"
npm run build

echo "==> Restart PM2"
if pm2 describe "$PM2_NAME" >/dev/null 2>&1; then
  pm2 restart "$PM2_NAME"
else
  pm2 start npm --name "$PM2_NAME" -- start
fi

pm2 save
echo "==> Done"

