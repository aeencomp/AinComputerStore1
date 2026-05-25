/** PM2 process config — used by deploy.sh so the app survives VPS reboots after `pm2 startup`. */
module.exports = {
  apps: [
    {
      name: "ain-app",
      cwd: "/home/deploy/AinComputerStore",
      script: "npm",
      args: "start",
      env: {
        NODE_ENV: "production",
        TZ: "Asia/Baghdad",
      },
      max_restarts: 15,
      min_uptime: "10s",
      restart_delay: 5000,
    },
  ],
};
