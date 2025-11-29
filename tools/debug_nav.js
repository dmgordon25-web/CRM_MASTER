
const puppeteer = require('puppeteer');

(async () => {
    console.log('Starting Navigation Debug...');
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
        ignoreHTTPSErrors: true
    });
    const page = await browser.newPage();

    try {
        page.on('console', msg => console.log(`[BROWSER] ${msg.type().toUpperCase()}: ${msg.text()}`));

        console.log('Step 1: Booting...');
        await page.goto('http://127.0.0.1:8080/crm-app/index.html', { waitUntil: 'networkidle0', timeout: 30000 });
        await page.waitForSelector('#main-nav', { timeout: 10000 });
        console.log('PASS: Dashboard loaded');

        // Test 1: Direct Router Call
        console.log('Step 2: Testing Router.goto directly...');
        const initialHash = await page.evaluate(() => window.location.hash);
        console.log('Initial Hash:', initialHash);

        await page.evaluate(() => {
            if (window.Router && window.Router.goto) {
                console.log('Calling Router.goto("partners")...');
                window.Router.goto('partners');
            } else {
                console.error('Router.goto not found!', window.Router);
            }
        });

        await new Promise(r => setTimeout(r, 1000));
        const hashAfterDirect = await page.evaluate(() => window.location.hash);
        console.log('Hash after direct call:', hashAfterDirect);

        if (hashAfterDirect.includes('partners')) {
            console.log('PASS: Direct Router.goto works');
        } else {
            console.error('FAIL: Direct Router.goto failed');
        }

        // Test 2: Click Listener
        console.log('Step 3: Testing Click Listener...');
        // Reset hash
        await page.evaluate(() => window.location.hash = '#/dashboard');
        await new Promise(r => setTimeout(r, 1000));

        await page.click('#main-nav button[data-nav="partners"]');
        await new Promise(r => setTimeout(r, 2000));

        const hashAfterClick = await page.evaluate(() => window.location.hash);
        console.log('Hash after click:', hashAfterClick);

        if (hashAfterClick.includes('partners')) {
            console.log('PASS: Click navigation works');
        } else {
            console.error('FAIL: Click navigation failed');
        }

        // Test 3: Action Bar Clear
        console.log('Step 4: Testing Action Bar Clear...');
        if (!hashAfterClick.includes('partners')) {
            console.log('Skipping Action Bar test because navigation failed');
        } else {
            // Wait for table
            await page.waitForSelector('#view-partners table tbody tr input[type="checkbox"]', { timeout: 5000 });
            // Click a checkbox
            await page.click('#view-partners table tbody tr:first-child input[type="checkbox"]');

            // Wait for action bar
            await page.waitForSelector('#actionbar[data-visible="1"]', { timeout: 5000 });
            console.log('PASS: Action Bar visible');

            // Click Clear
            await page.click('#actionbar [data-act="clear"]');

            // Wait for action bar to hide
            await page.waitForFunction(() => {
                const bar = document.getElementById('actionbar');
                return !bar.hasAttribute('data-visible') || bar.getAttribute('data-visible') === '0';
            }, { timeout: 5000 });
            console.log('PASS: Action Bar cleared');
        }

        await browser.close();

    } catch (err) {
        console.error('DEBUG FAILED:', err);
        await browser.close();
    }
})();
