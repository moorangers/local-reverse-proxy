module.exports = {
  apps: [
    {
      name: 'local-reverse-proxy',
      script: 'dist/index.js',
      cwd: __dirname,
      interpreter: process.execPath,
      env: {
        NODE_ENV: 'production',
      },
      autorestart: true,
      max_restarts: 10,
      min_uptime: '5s',
      restart_delay: 2000,
      time: true,
    },
  ],
};
