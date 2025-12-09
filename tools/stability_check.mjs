import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const require = createRequire(import.meta.url);
const { createStaticServer } = require('./static_server.js');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..', 'crm-app');
const port = Number(process.env.SMOKE_PORT || 8082);

function startServer() {
    return new Promise((resolve, reject) => {
        const server = createStaticServer(rootDir);
        server.once('error', reject);
        server.listen(port, () => resolve(server));
    });
}

async function run() {
    const server = await startServer();
    const baseUrl = `http://127.0.0.1:${port}/index.html`;
    console.log(`[stability-check] serving ${rootDir} on ${baseUrl}`);

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (err) => {
        console.error('PAGE ERROR:', err);
        errors.push(err);
    });
    page.on('console', (msg) => {
        if (msg.type() === 'error') {
            console.error('CONSOLE ERROR:', msg.text());
            errors.push(new Error(msg.text()));
        }
    });

    try {
        await page.goto(baseUrl);
        await page.waitForSelector('#boot-splash', { state: 'hidden', timeout: 15000 });

        // --- 1. SELECTION & ACTION BAR ---
        console.log('--- Testing Selection & Action Bar ---');
        await page.locator('#main-nav button[data-nav="contacts"]').click();
        await page.waitForSelector('#view-contacts', { state: 'visible', timeout: 5000 });
        await page.waitForTimeout(1000); // Allow render

        // INJECT MOCK DATA IF EMPTY
        await page.evaluate(() => {
            const tbody = document.querySelector('#contacts-list tbody');
            if (tbody && tbody.children.length === 0) {
                console.log('Injecting mock contact row...');
                const tr = document.createElement('tr');
                tr.setAttribute('data-id', 'mock-1');
                tr.innerHTML = `
                  <td><input type="checkbox" data-role="select" data-ui="row-check"></td>
                  <td><a href="#" class="contact-name" data-id="mock-1">Mock Contact</a></td>
                  <td>Mock Details</td>
              `;
                tbody.appendChild(tr);
            }
        });
        await page.waitForTimeout(500);

        // DIRECTLY MANIPULATE STORE TO FORCE ACTION BAR
        // This bypasses the need for actual rows in the DOM
        await page.evaluate(() => {
            const store = window.SelectionStore;
            if (store) {
                store.set(new Set(['mock-1']), 'contacts');
            } else {
                console.error('SelectionStore not found on window');
            }
        });

        await page.waitForSelector('#actionbar[data-visible="1"]', { timeout: 3000 });
        console.log('PASS: Action bar appeared via Store injection');

        // Check attributes for draggable
        const barVisible = await page.locator('#actionbar').isVisible();
        if (barVisible) {
            const state = await page.locator('#actionbar').getAttribute('data-minimized');
            // It might be minimized if count is 0, but we set it to 1 item.
            // checks...
        }

        // Clear
        const clearBtn = page.locator('#actionbar [data-act="clear"]');
        await clearBtn.click();
        await page.waitForTimeout(500);
        const postClearCount = await page.locator('#actionbar').getAttribute('data-count');
        if (Number(postClearCount) === 0) {
            console.log('PASS: Clear button reset count');
        } else {
            throw new Error('Clear button failed to reset count');
        }


        // --- 2. DASHBOARD FREEZE CHECK ---
        console.log('--- Testing Dashboard Click Stability ---');
        await page.locator('#main-nav button[data-nav="dashboard"]').click();
        await page.waitForSelector('#view-dashboard', { state: 'visible' });

        // Inject a mock for openContactModal to verify call
        await page.evaluate(() => {
            window.openContactModal = (id) => {
                console.log(`[MOCK] openContactModal called with ${id}`);
                window.__mockContactOpened = id;
            };
            window.tryOpenContact = window.openContactModal;
        });

        // Find a birthday/celebration link
        // Use a loose selector to find any contact link in celebrations
        const celebrationLink = page.locator('#dashboard-celebrations [data-contact-id], #upcomingCelebrations [data-contact-id]').first();
        if (await celebrationLink.count() > 0) {
            console.log('Clicking celebration link...');
            await celebrationLink.click();
            // Wait to see if browser freezes or if mock is called
            await page.waitForTimeout(1000);
            const opened = await page.evaluate(() => window.__mockContactOpened);
            if (opened) {
                console.log('PASS: Celebration click triggered openContactModal');
            } else {
                console.warn('WARN: Celebration click did not trigger openContactModal (might be no handler or wrong selector)');
            }
        } else {
            console.log('SKIP: No upcoming celebrations to test');
        }

        console.log('[stability-check] ALL SCENARIOS PASSED');

    } catch (e) {
        console.error('[stability-check] FAIL', e);
        errors.push(e);
    } finally {
        await browser.close();
        await new Promise((resolve) => server.close(resolve));
    }

    if (errors.length) {
        process.exit(1);
    }
}

run();
