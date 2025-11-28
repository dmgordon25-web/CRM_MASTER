
const puppeteer = require('puppeteer');

(async () => {
    console.log('Starting Critical Path Verification...');
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
        ignoreHTTPSErrors: true
    });
    const page = await browser.newPage();

    try {
        // Enable console logging
        page.on('console', msg => {
            console.log(`[BROWSER] ${msg.type().toUpperCase()}: ${msg.text()}`);
        });

        // 1. Boot
        console.log('Step 1: Booting...');
        // Use 127.0.0.1 to avoid localhost resolution issues
        await page.goto('http://127.0.0.1:8080/crm-app/index.html', { waitUntil: 'networkidle0', timeout: 30000 });

        await page.waitForSelector('#main-nav', { timeout: 10000 });
        console.log('PASS: Dashboard loaded');

        // 2. Navigation Test
        console.log('Step 2: Testing Navigation...');
        // "Contacts" button is missing in index.html, using "Partners" to verify nav works
        await page.waitForSelector('#main-nav button[data-nav="partners"]', { timeout: 5000 });

        const initialHash = await page.evaluate(() => window.location.hash);
        console.log('Initial Hash:', initialHash);

        await page.click('#main-nav button[data-nav="partners"]');

        try {
            await page.waitForFunction(() => window.location.hash.includes('#/partners'), { timeout: 10000 });
            console.log('PASS: Navigation to Partners');
        } catch (e) {
            const currentHash = await page.evaluate(() => window.location.hash);
            console.error('FAIL: Navigation timeout. Current Hash:', currentHash);
            throw e;
        }

        // 3. Editor Test
        console.log('Step 3: Testing Editor Open...');
        await page.waitForSelector('#btn-header-new', { timeout: 5000 });
        await page.click('#btn-header-new');

        // Wait for menu
        await page.waitForSelector('#header-new-menu', { visible: true, timeout: 5000 });

        // Click Contact - try multiple selectors
        const contactBtn = await page.waitForSelector('button[data-action="contact"], #header-new-menu button:first-child', { timeout: 5000 });
        await contactBtn.click();

        // Wait for modal
        await page.waitForSelector('[data-ui="contact-edit-modal"]', { visible: true, timeout: 10000 });
        console.log('PASS: Contact Editor Opened');

        // 4. CRUD Test
        console.log('Step 4: Testing CRUD (Create)...');
        await page.type('[data-ui="contact-edit-modal"] input[name="firstName"]', 'Puppeteer');
        await page.type('[data-ui="contact-edit-modal"] input[name="lastName"]', 'Test');

        // Click Save
        await page.click('[data-ui="contact-edit-modal"] button[data-role="save"]');

        // Wait for modal to close
        await page.waitForSelector('[data-ui="contact-edit-modal"]', { hidden: true, timeout: 10000 });

        // Verify in list
        console.log('Navigating to Pipeline to verify contact...');
        await page.click('#main-nav button[data-nav="pipeline"]');
        await page.waitForFunction(() => window.location.hash.includes('#/pipeline'), { timeout: 5000 });

        // Wait for row with "Puppeteer Test"
        await page.waitForFunction(() => {
            const rows = Array.from(document.querySelectorAll('tr, .kanban-card')); // Support list or kanban
            return rows.some(r => r.textContent.includes('Puppeteer Test'));
        }, { timeout: 10000 });
        console.log('PASS: Contact Created and Verified in List');

        console.log('ALL TESTS PASSED');
        await browser.close();
        process.exit(0);

    } catch (err) {
        console.error('VERIFICATION FAILED:', err);
        try {
            await page.screenshot({ path: 'verification_failure.png' });
        } catch (e) {
            console.error('Failed to take screenshot:', e);
        }
        await browser.close();
        process.exit(1);
    }
})();
