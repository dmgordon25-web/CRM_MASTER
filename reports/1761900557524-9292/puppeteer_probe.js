import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const RUN_ID = '1761900557524-9292';
const userDataDir = path.resolve(process.cwd(), '.runs', RUN_ID, 'chrome-profile');
fs.mkdirSync(userDataDir, { recursive: true });

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    userDataDir,
  });
  try {
    const page = await browser.newPage();
    await page.goto('about:blank');
    const userAgent = await page.evaluate(() => navigator.userAgent);
    console.log('userAgent', userAgent);
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error('puppeteer_probe_error', error);
  process.exitCode = 1;
});
