#!/usr/bin/env bash
# One-time VPS setup so GitHub Actions can SSH and run deploy.sh (run as root).
#   curl -fsSL https://raw.githubusercontent.com/aeencomp/AinComputerStore1/main/scripts/vps-setup-github-deploy.sh | sudo bash
# Or after git pull:
#   sudo bash /home/deploy/AinComputerStore/scripts/vps-setup-github-deploy.sh
set -euo pipefail

DEPLOY_USER="deploy"
APP_DIR="/home/deploy/AinComputerStore"
KEY="$APP_DIR/.ssh/github_actions_deploy"

if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root: sudo bash $0"
  exit 1
fi

echo "==> Fix project ownership (fixes npm EACCES for deploy user)"
chown -R "${DEPLOY_USER}:${DEPLOY_USER}" "$APP_DIR"

echo "==> SSH directory for ${DEPLOY_USER}"
install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "/home/${DEPLOY_USER}/.ssh"
AUTH="/home/${DEPLOY_USER}/.ssh/authorized_keys"
touch "$AUTH"
chown "$DEPLOY_USER:$DEPLOY_USER" "$AUTH"
chmod 600 "$AUTH"

if [ ! -f "$KEY" ]; then
  echo "==> Creating deploy key for GitHub Actions"
  sudo -u "$DEPLOY_USER" ssh-keygen -t ed25519 -f "$KEY" -N "" -C "github-actions-deploy"
fi
chown "$DEPLOY_USER:$DEPLOY_USER" "$KEY" "${KEY}.pub"
chmod 600 "$KEY"

PUB=$(cat "${KEY}.pub")
if ! grep -qF "$PUB" "$AUTH" 2>/dev/null; then
  echo "$PUB" >> "$AUTH"
  echo "==> Added public key to ${DEPLOY_USER} authorized_keys"
fi

echo "==> fail2ban: unban SSH (if installed)"
if command -v fail2ban-client >/dev/null 2>&1; then
  fail2ban-client unban --all 2>/dev/null || true
fi

echo "==> UFW: allow OpenSSH (if ufw active)"
if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -q "Status: active"; then
  ufw allow OpenSSH || true
  ufw status | head -20
fi

echo ""
echo "=============================================="
echo "Add these in GitHub → AinComputerStore1 → Settings → Secrets and variables → Actions"
echo ""
echo "  Secret  VPS_HOST     = your server public IP or hostname"
echo "  Secret  VPS_USER     = deploy"
echo "  Secret  VPS_PORT     = 22   (only if SSH is not on 22)"
echo "  Secret  VPS_SSH_KEY  = paste private key below (full file)"
echo ""
echo "----------------------------------------------"
cat "$KEY"
echo "----------------------------------------------"
echo ""
echo "Optional: Repository Variable SELF_HOSTED = 1 if you use a self-hosted runner instead."
echo "Test from your PC: ssh -i <saved-key> deploy@YOUR_HOST"
echo "Then push to main — workflow Auto Deploy VPS should run ./deploy.sh on the server."
