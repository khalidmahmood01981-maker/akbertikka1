module.exports = {
  apps: [
    {
      name: "smart-crm-pos",
      script: "./node_modules/tsx/dist/cli.mjs",
      args: "server.ts",
      watch: false,
      env: {
        NODE_ENV: "development",
      }
    }
  ]
};
