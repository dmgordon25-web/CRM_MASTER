
const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    // Helper to log pass/fail
    const log = (test, pass, msg) => {
        console.log(`[${pass ? 'PASS' : 'FAIL'}] ${test}: ${msg}`);
    };

    try {
        console.log('Navigating to CRM...');
        await page.goto('http://localhost:8000', { waitUntil: 'networkidle0' });

        // 1. Scroll Check
        console.log('Running Scroll Check...');
        const overflow = await page.evaluate(() => document.body.style.overflow);
        if (overflow === '' || overflow === 'auto' || overflow === 'visible') {
            log('Scroll Check', true, `Body overflow is "${overflow}"`);
        } else {
            log('Scroll Check', false, `Body overflow is "${overflow}"`);
        }

        // 2. Calendar Check
        console.log('Running Calendar Check...');
        // Navigate to Calendar
        await page.evaluate(() => window.location.hash = '#/calendar');
        await new Promise(r => setTimeout(r, 2000)); // Wait for render

        const calendarContent = await page.evaluate(() => {
            const root = document.getElementById('view-calendar');
            return root ? root.innerText : '';
        });

        if (calendarContent.includes('Loading') || calendarContent.includes('Error') || calendarContent.includes('unavailable')) {
            log('Calendar Check', false, `Content indicates failure: ${calendarContent.substring(0, 50)}...`);
        } else if (calendarContent.length > 0) {
            log('Calendar Check', true, 'Calendar view has content and no error text.');
        } else {
            log('Calendar Check', false, 'Calendar view is empty.');
        }

        // 3. Contact Button Check
        console.log('Running Contact Button Check...');
        // Navigate back to dashboard to ensure clean state
        await page.evaluate(() => window.location.hash = '#/dashboard');
        await new Promise(r => setTimeout(r, 1000));

        // Click "New+" button to open menu
        const newBtnSelector = '#btn-header-new';
        await page.waitForSelector(newBtnSelector);
        await page.click(newBtnSelector);
        await new Promise(r => setTimeout(r, 500));

        // Click "Contact" in menu
        const contactBtnSelector = 'button[data-role="header-new-contact"]';
        await page.waitForSelector(contactBtnSelector);
        await page.click(contactBtnSelector);

        // Wait for modal
        try {
            await page.waitForSelector('[data-ui="contact-edit-modal"]', { visible: true, timeout: 5000 });
            log('Contact Button Check', true, 'Contact modal appeared.');
        } catch (e) {
            // Try fallback selector
            try {
                await page.waitForSelector('.modal-dialog', { visible: true, timeout: 2000 });
                log('Contact Button Check', true, 'Contact modal appeared (fallback selector).');
            } catch (e2) {
                log('Contact Button Check', false, 'Contact modal did not appear.');
            }
        }

    } catch (error) {
        console.error('Verification failed with error:', error);
    } finally {
        await browser.close();
    }
})();
