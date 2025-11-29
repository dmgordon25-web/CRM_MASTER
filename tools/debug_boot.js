const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process');

async function debugBoot() {
    console.log('Starting Boot Debugger...');
    let browser;
    try {
        // Try to find chrome/edge path
        const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
        const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
        const executablePath = require('fs').existsSync(chromePath) ? chromePath : edgePath;

        browser = await puppeteer.launch({
            executablePath,
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();

        // Capture all console messages
        page.on('console', msg => console.log(`[BROWSER_CONSOLE] ${msg.type().toUpperCase()}: ${msg.text()}`));
        page.on('pageerror', err => console.log(`[BROWSER_ERROR] ${err.toString()}`));
        page.on('requestfailed', req => console.log(`[BROWSER_REQ_FAIL] ${req.url()} - ${req.failure().errorText}`));

        console.log('Navigating to http://localhost:8080...');
        await page.goto('http://localhost:8080', { waitUntil: 'networkidle2', timeout: 15000 });

        console.log('Navigation complete. Waiting 5s for any late errors...');
        await new Promise(r => setTimeout(r, 5000));

    } catch (err) {
        console.error('[DEBUGGER_CRASH]', err);
    } finally {
        if (browser) await browser.close();
    }
}

debugBoot();
