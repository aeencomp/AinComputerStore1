#!/usr/bin/env bash
# Invoked on the VPS by GitHub Actions (SSH). Keep in repo root.
set -euo pipefail
DEPLOY_DIR=/home/deploy/AinComputerStore
if [ ! -d "$DEPLOY_DIR" ]; then
  echo "Missing $DEPLOY_DIR"
  exit 1
fi
cd "$DEPLOY_DIR"
chmod +x ./deploy.sh
./deploy.sh
