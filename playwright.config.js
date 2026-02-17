const { defineConfig } = require('@playwright/test');
const path = require('path');

const serveRoot = path.join(__dirname, 'crm-app');
const serverScript = path.join(__dirname, 'tools', 'node_static_server.js');
const launchArgs = process.env.CI
  ? ['--disable-dev-shm-usage', '--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  : [];

module.exports = defineConfig({
  testDir: path.join(__dirname, 'tests', 'e2e'),
  timeout: 60 * 1000,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  use: {
    baseURL: 'http://127.0.0.1:8080',
    trace: 'retain-on-failure',
    launchOptions: launchArgs.length ? { args: launchArgs } : undefined
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' }
    }
  ],
  webServer: {
    command: `node ${JSON.stringify(serverScript)} ${JSON.stringify(serveRoot)} 8080`,
    url: 'http://127.0.0.1:8080/healthz',
    reuseExistingServer: !process.env.CI,
    timeout: 60 * 1000
  }
});
