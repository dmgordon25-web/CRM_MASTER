const { defineConfig } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const os = require('os');

function resolveChromeExecutable() {
  const envPath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    || process.env.CHROMIUM_PATH
    || process.env.PW_CHROMIUM_PATH;
  if (envPath && fs.existsSync(envPath)) return envPath;

  const cacheRoot = path.join(os.homedir(), '.cache', 'puppeteer', 'chrome');
  if (fs.existsSync(cacheRoot)) {
    const entries = fs.readdirSync(cacheRoot).filter(Boolean).sort().reverse();
    for (const entry of entries) {
      const candidate = path.join(cacheRoot, entry, 'chrome-linux64', 'chrome');
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return undefined;
}

const serveRoot = path.join(__dirname, 'crm-app');
const serverScript = path.join(__dirname, 'tools', 'node_static_server.js');
const executablePath = resolveChromeExecutable();

module.exports = defineConfig({
  testDir: path.join(__dirname, 'tests', 'e2e'),
  timeout: 60 * 1000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: 'http://127.0.0.1:8080',
    trace: 'retain-on-failure',
    executablePath,
    launchOptions: executablePath ? { executablePath } : undefined
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' }
    }
  ],
  webServer: {
    command: `node ${JSON.stringify(serverScript)} ${JSON.stringify(serveRoot)} 8080`,
    port: 8080,
    reuseExistingServer: !process.env.CI,
    timeout: 30 * 1000
  }
});
