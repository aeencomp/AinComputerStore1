/** PM2 process config — used by deploy.sh so the app survives VPS reboots after `pm2 startup`. */
module.exports = {
  apps: [
    {
      name: "ain-app",
      cwd: "/home/deploy/AinComputerStore",
      script: "scripts/start-prod.sh",
      interpreter: "bash",
      env: {
        NODE_ENV: "production",
        TZ: "Asia/Baghdad",
      },
      max_restarts: 30,
      min_uptime: "15s",
      restart_delay: 5000,
      autorestart: true,
      max_memory_restart: "900M",
    },
  ],
};
