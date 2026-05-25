module.exports = {
  apps: [
    {
      name: "barberia-api",
      cwd: "/var/www/barberiasuite/backend",
      script: "dist/index.js",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: "4000",
      },
    },
  ],
};
