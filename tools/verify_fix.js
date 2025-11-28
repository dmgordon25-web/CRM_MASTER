const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();

    try {
        console.log('Navigating to dashboard...');

        // Setup listeners before navigation
        page.on('console', msg => {
            console.log(`CONSOLE [${msg.type()}]: ${msg.text()}`);
        });

        page.on('response', response => {
            console.log(`RESPONSE: ${response.status()} ${response.url()}`);
        });

        page.on('requestfailed', request => {
            console.log(`REQUEST FAILED: ${request.failure().errorText} ${request.url()}`);
        });

        await page.goto('http://localhost:8080', { waitUntil: 'networkidle0' });

        // Verify Dashboard Load
        await page.waitForSelector('#main-nav', { timeout: 5000 });
        console.log('Dashboard loaded.');

        // Check if CRM is defined
        const crmDefined = await page.evaluate(() => !!window.CRM);
        console.log(`window.CRM defined: ${crmDefined}`);

        // Action: Click button[data-nav="pipeline"]
        console.log('Clicking Pipeline...');
        await page.click('button[data-nav="pipeline"]');
        await new Promise(r => setTimeout(r, 1000)); // Wait for hash update
        const hash = await page.evaluate(() => window.location.hash);
        if (hash !== '#/pipeline') {
            throw new Error(`Expected hash #/pipeline, got ${hash}`);
        }
        console.log('Pipeline navigation verified.');

        // Action: Click #btn-global-new
        console.log('Clicking Global New...');
        await page.click('#btn-header-new');
        await page.waitForSelector('#header-new-menu[aria-hidden="false"]', { timeout: 2000 });
        console.log('Global New menu opened.');

        // Action: Click "Contact"
        console.log('Clicking Contact...');
        await page.click('button[data-role="header-new-contact"]');
        await page.waitForSelector('[data-ui="contact-edit-modal"]', { visible: true, timeout: 5000 });
        console.log('Contact Editor opened.');

        // Close modal
        await page.evaluate(() => {
            const m = document.querySelector('[data-ui="contact-edit-modal"]');
            if (m) m.style.display = 'none';
        });

        // Action: Click "New" -> "Partner"
        // Re-open menu first
        await page.click('#btn-global-new');
        await page.waitForSelector('#header-new-menu[aria-hidden="false"]', { timeout: 2000 });

        console.log('Clicking Partner...');
        await page.click('button[data-role="header-new-partner"]');
        await page.waitForSelector('[data-ui="partner-edit-modal"]', { visible: true, timeout: 5000 });
        console.log('Partner Editor opened.');

        console.log('VERIFICATION PASSED');
    } catch (err) {
        console.error('VERIFICATION FAILED:', err);
        process.exit(1);
    } finally {
        await browser.close();
    }
})();
