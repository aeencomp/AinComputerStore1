#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/home/deploy/AinComputerStore"
PM2_NAME="ain-app"

run_post_deploy_sync() {
  if [ "${DEPLOY_RUN_SYNC:-}" != "1" ]; then
    return 0
  fi
  echo "==> Post-deploy catalog sync"
  local port="${PORT:-5000}"
  if curl -sf -X POST "http://127.0.0.1:${port}/api/internal/catalog-sync" >/dev/null 2>&1; then
    echo "==> Catalog sync started (in-app)"
    return 0
  fi
  if [ -x node_modules/.bin/tsx ]; then
    nohup npm run sync:prices >> "${HOME}/catalog-sync.log" 2>&1 &
    echo "==> Catalog sync started (CLI fallback)"
  else
    echo "WARNING: could not start catalog sync"
  fi
}

cd "$APP_DIR"

git config --global --add safe.directory "$APP_DIR" 2>/dev/null || true

export PATH="$HOME/.local/bin:$HOME/bin:/usr/local/bin:$PATH"
if [ -s "$HOME/.nvm/nvm.sh" ]; then
  # shellcheck disable=SC1091
  . "$HOME/.nvm/nvm.sh"
fi

if [ "$(id -un)" != "deploy" ]; then
  if [ "$(id -u)" = "0" ]; then
    echo "==> Running as root — fixing ownership and re-running as deploy"
    chown -R deploy:deploy "$APP_DIR"
    exec su - deploy -c "bash -lc 'cd \"$APP_DIR\" && ./deploy.sh'"
  fi
  echo "ERROR: deploy.sh must run as user deploy (current: $(whoami))"
  exit 1
fi

if [ ! -f .env ]; then
  echo "ERROR: missing $APP_DIR/.env (DATABASE_URL, SESSION_SECRET, PORT, ...)"
  exit 1
fi

# .env may reference optional vars; do not use nounset while sourcing
set +u
set -a
# shellcheck disable=SC1091
source .env
set +a
set -u

echo "==> Node $(node -v) | npm $(npm -v)"
echo "==> Commit $(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
echo "==> PORT=${PORT:-5000}"

echo "==> Pull latest code"
git remote set-url origin https://github.com/aeencomp/AinComputerStore1.git 2>/dev/null || true
git fetch --all --prune
git reset --hard origin/main

if [ "${SKIP_VPS_BUILD:-}" = "1" ]; then
  echo "==> SKIP_VPS_BUILD=1 — using dist from GitHub Actions (no npm ci/build on VPS)"
  if [ ! -f dist/index.js ] || [ ! -f dist/public/index.html ]; then
    echo "ERROR: dist/index.js or dist/public/index.html missing on VPS"
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
      run_post_deploy_sync
      echo "==> Done"
      exit 0
    fi
    sleep 3
  done
  echo "WARNING: health check failed — check: pm2 logs $PM2_NAME --lines 80"
  pm2 logs "$PM2_NAME" --lines 40 --nostream || true
  run_post_deploy_sync || true
  exit 0
fi

if [ -d node_modules ] && ! touch node_modules/.write-test 2>/dev/null; then
  echo "==> node_modules not writable — attempting chown (deploy sudo or ask root once)"
  sudo -n chown -R deploy:deploy "$APP_DIR" 2>/dev/null || true
fi
if [ -d node_modules ] && ! touch node_modules/.write-test 2>/dev/null; then
  echo "ERROR: node_modules is not writable (often caused by running npm as root)."
  echo "       As root run: chown -R deploy:deploy $APP_DIR"
  exit 1
fi
rm -f node_modules/.write-test 2>/dev/null || true

# .env often sets NODE_ENV=production; npm then skips devDependencies (vite, esbuild) and build fails
_runtime_node_env="${NODE_ENV:-production}"
unset NODE_ENV
export NPM_CONFIG_PRODUCTION=false

echo "==> Install dependencies (keeping app running until build succeeds)"
if ! npm ci --no-audit --no-fund --include=dev; then
  echo "==> npm ci failed; clean retry if we can remove node_modules"
  if rm -rf node_modules 2>/dev/null; then
    npm ci --no-audit --no-fund --include=dev
  else
    echo "ERROR: cannot fix node_modules — run as root: chown -R deploy:deploy $APP_DIR"
    exit 1
  fi
fi

echo "==> Build"
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=2048}"
npm run build
export NODE_ENV="$_runtime_node_env"

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
    run_post_deploy_sync
    echo "==> Done"
    exit 0
  fi
  sleep 3
done

echo "WARNING: health check failed — check: pm2 logs $PM2_NAME --lines 80"
pm2 logs "$PM2_NAME" --lines 40 --nostream || true
run_post_deploy_sync || true
exit 0
