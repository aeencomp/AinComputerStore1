#!/usr/bin/env bash
# One-time setup: GitHub Actions self-hosted runner on this VPS (recommended when SSH deploy from GitHub fails).
# Run as user `deploy`:
#   bash scripts/setup-github-actions-runner.sh
set -euo pipefail

REPO="aeencomp/AinComputerStore1"
RUNNER_VERSION="${RUNNER_VERSION:-2.321.0}"
RUNNER_DIR="${HOME}/actions-runner"

echo "==> GitHub self-hosted runner for ${REPO}"
echo "    1. Open: https://github.com/${REPO}/settings/actions/runners/new?arch=x64&os=linux"
echo "    2. Copy the registration token (valid ~1 hour)"
echo ""
read -r -p "Paste registration token: " RUNNER_TOKEN
if [ -z "${RUNNER_TOKEN}" ]; then
  echo "No token provided."
  exit 1
fi

mkdir -p "${RUNNER_DIR}"
cd "${RUNNER_DIR}"

if [ ! -f ./config.sh ]; then
  curl -fsSL -o actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz \
    "https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz"
  tar xzf "actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz"
fi

./config.sh --url "https://github.com/${REPO}" --token "${RUNNER_TOKEN}" --name "hostkey-vps" --labels "self-hosted,Linux,X64,ain-vps" --unattended

sudo ./svc.sh install deploy
sudo ./svc.sh start
sudo ./svc.sh status

echo ""
echo "==> Then in GitHub repo Settings → Secrets and variables → Actions → Variables:"
echo "    Name: SELF_HOSTED   Value: 1"
echo "==> Push to main again; deploy runs on this server (no inbound SSH from GitHub)."
