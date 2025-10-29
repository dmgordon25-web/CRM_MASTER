import { createRequire } from 'node:module';
import process from 'node:process';

const require = createRequire(import.meta.url);

export async function detectBrowserEnv() {
  let playwright;
  try {
    playwright = require('playwright');
  } catch (err) {
    return { hasBrowser: false, reason: 'no-playwright' };
  }

  try {
    const browser = await playwright.chromium.launch({ headless: true });
    await browser.close();
    return { hasBrowser: true };
  } catch (err) {
    return { hasBrowser: false, reason: 'launch-failed' };
  }
}

export function isCI() {
  const env = process.env || {};
  const truthy = (value) => value && value !== '0' && value !== 'false';
  const keys = [
    'CI',
    'CONTINUOUS_INTEGRATION',
    'BUILD_NUMBER',
    'RUN_ID',
    'GITHUB_ACTIONS',
    'GITLAB_CI',
    'CIRCLECI',
    'TRAVIS',
    'TEAMCITY_VERSION',
    'BUILDKITE',
    'JENKINS_HOME'
  ];
  return keys.some((key) => truthy(env[key]));
}
