#!/usr/bin/env node
import { execSync } from 'node:child_process';

function listBrowsers() {
  try {
    return execSync('npx playwright install --list', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    });
  } catch {
    return '';
  }
}

const listing = listBrowsers();
const hasBrowsers = /ms-playwright\/.+\d+/i.test(listing);

if (hasBrowsers) {
  console.log('[postinstall] Playwright browsers already installed; skipping download.');
  process.exit(0);
}

console.log('[postinstall] Playwright browsers missing; installing Chromium/Firefox/WebKit.');
execSync('npx playwright install', { stdio: 'inherit' });
