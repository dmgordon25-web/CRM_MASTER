
const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    try {
        console.log('Navigating to CRM...');
        await page.goto('http://127.0.0.1:8080/index.html?skipBootAnimation=1', { waitUntil: 'networkidle0' });

        console.log('Waiting for dashboard...');
        await page.waitForSelector('#view-dashboard', { timeout: 5000 });

        // Function to check table alignment
        const checkAlignment = async () => {
            return await page.evaluate(() => {
                const tables = document.querySelectorAll('table');
                const results = [];
                tables.forEach(table => {
                    const id = table.id || 'unknown';
                    const thead = table.tHead;
                    const tbody = table.tBodies[0];

                    if (!thead || !tbody) {
                        results.push({ id, status: 'skipped', reason: 'missing head or body' });
                        return;
                    }

                    const headerRow = thead.rows[0];
                    const bodyRow = tbody.rows[0];

                    if (!headerRow) {
                        results.push({ id, status: 'skipped', reason: 'empty header' });
                        return;
                    }
                    if (!bodyRow) {
                        results.push({ id, status: 'ok', reason: 'empty body' }); // Empty body is fine
                        return;
                    }

                    const headerCells = headerRow.cells.length;
                    const bodyCells = bodyRow.cells.length;

                    if (headerCells !== bodyCells) {
                        results.push({
                            id,
                            status: 'mismatch',
                            header: headerCells,
                            body: bodyCells,
                            headerHTML: headerRow.innerHTML,
                            bodyHTML: bodyRow.innerHTML
                        });
                    } else {
                        results.push({ id, status: 'ok', header: headerCells, body: bodyCells });
                    }
                });
                return results;
            });
        };

        console.log('Checking Dashboard tables...');
        let results = await checkAlignment();
        console.log('Dashboard Results:', JSON.stringify(results, null, 2));

        // Navigate to Partners
        console.log('Navigating to Partners...');
        await page.click('button[data-nav="partners"]');
        await page.waitForSelector('#view-partners', { timeout: 2000 });
        await new Promise(r => setTimeout(r, 1000)); // Wait for render

        console.log('Checking Partners tables...');
        results = await checkAlignment();
        console.log('Partners Results:', JSON.stringify(results, null, 2));

        // Navigate to Contacts
        console.log('Navigating to Contacts...');
        await page.click('button[data-nav="contacts"]');
        await page.waitForSelector('#view-contacts', { timeout: 2000 });
        await new Promise(r => setTimeout(r, 1000)); // Wait for render

        console.log('Checking Contacts tables...');
        results = await checkAlignment();
        console.log('Contacts Results:', JSON.stringify(results, null, 2));

        // Navigate to Pipeline
        console.log('Navigating to Pipeline...');
        await page.click('button[data-nav="pipeline"]');
        await page.waitForSelector('#view-pipeline', { timeout: 2000 });
        await new Promise(r => setTimeout(r, 1000)); // Wait for render

        console.log('Checking Pipeline tables...');
        results = await checkAlignment();
        console.log('Pipeline Results:', JSON.stringify(results, null, 2));

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await browser.close();
    }
})();
