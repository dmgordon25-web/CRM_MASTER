const puppeteer = require('puppeteer-core');

async function debugFunctional() {
    console.log('Starting Functional Debugger...');
    let browser;
    try {
        const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
        const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
        const executablePath = require('fs').existsSync(chromePath) ? chromePath : edgePath;

        browser = await puppeteer.launch({
            executablePath,
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,800']
        });

        const page = await browser.newPage();
        page.on('console', msg => console.log(`[BROWSER] ${msg.type().toUpperCase()}: ${msg.text()}`));

        // 1. Boot
        console.log('Navigating to Dashboard...');
        await page.goto('http://localhost:8080', { waitUntil: 'networkidle2' });
        await page.waitForSelector('#view-dashboard', { timeout: 10000 });
        console.log('Dashboard loaded.');

        // DEBUG: Fetch render.js to see what the browser sees
        try {
            const renderContent = await page.evaluate(async () => {
                const res = await fetch('/js/render.js');
                const text = await res.text();
                return { status: res.status, type: res.headers.get('content-type'), snippet: text.substring(0, 200) };
            });
            console.log('[DEBUG] render.js fetch:', renderContent);
        } catch (e) {
            console.error('[DEBUG] render.js fetch failed:', e);
        }
        // 2. Check "New+" Buttons
        const newButtons = await page.$$eval('button', btns =>
            btns.filter(b => b.textContent.trim() === 'New+' || b.id === 'header-new-toggle').map(b => ({
                id: b.id,
                text: b.textContent,
                visible: b.offsetParent !== null
            }))
        );
        console.log('Found "New+" buttons:', newButtons);

        // DEBUG: Manual import attempt
        try {
            await page.evaluate(async () => {
                const imports = [
                    '/js/ui/strings.js',
                    '/js/pipeline/stages.js',
                    '/js/pipeline/constants.js',
                    '/js/editors/partner_entry.js',
                    '/js/app_services.js',
                    '/js/render.js'
                ];

                for (const url of imports) {
                    try {
                        await import(url);
                        console.log(`[DEBUG] Import SUCCESS: ${url}`);
                    } catch (e) {
                        const msg = e.message || e.toString();
                        const stack = e.stack || '';
                        console.error(`[DEBUG] Import FAILED: ${url} ${msg} ${stack}`);
                    }
                }
            });
        } catch (e) {
            console.error('[DEBUG] Manual import execution failed:', e);
        }
        // 3. Test Calendar
        console.log('Navigating to Calendar...');
        await page.goto('http://localhost:8080/#/calendar', { waitUntil: 'networkidle2' });

        // Wait a bit for render
        await new Promise(r => setTimeout(r, 2000));

        const calendarGrid = await page.$('#calendar-root');
        const gridContent = await page.evaluate(el => el ? el.innerHTML.length : 0, calendarGrid);
        console.log(`Calendar Root found: ${!!calendarGrid}, Content Length: ${gridContent}`);

        const calendarView = await page.$('#view-calendar');
        const viewVisible = await page.evaluate(el => el && el.offsetParent !== null, calendarView);
        console.log(`Calendar View Visible: ${viewVisible}`);

        // 4. Test Action Bar
        console.log('Testing Action Bar...');
        // Simulate selection
        await page.evaluate(() => {
            if (window.SelectionStore) {
                window.SelectionStore.set(['test-id-1'], 'contacts');
            }
        });
        await new Promise(r => setTimeout(r, 500));
        // Click Clear
        const clearBtn = await page.$('button[data-action="clear"]');
        if (clearBtn) {
            console.log('Clicking Clear button...');
            // Ensure button is visible and clickable
            await page.waitForFunction(btn => {
                const rect = btn.getBoundingClientRect();
                return rect.width > 0 && rect.height > 0 && window.getComputedStyle(btn).visibility !== 'hidden';
            }, {}, clearBtn);

            await clearBtn.click();
            await new Promise(r => setTimeout(r, 1000));

            const actionBarHidden = await page.evaluate(el => !el || el.offsetParent === null, actionBar);
            console.log(`Action Bar Hidden (after clear): ${actionBarHidden}`);
        } else {
            console.log('Clear button not found in Action Bar');
        }

    } catch (err) {
        console.error('[DEBUGGER_CRASH]', err);
    } finally {
        if (browser) await browser.close();
    }
}

debugFunctional();
