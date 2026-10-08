#!/usr/bin/env bash
set -euo pipefail
APP_DIR="/home/deploy/AinComputerStore"
cd "$APP_DIR"
if [ ! -f .env ]; then
  echo "Missing .env in $APP_DIR"
  exit 1
fi
set -a
# shellcheck disable=SC1091
source .env
set +a
exec node dist/index.js
