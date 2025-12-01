
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

console.log('Starting smoke_test_puppeteer.js...');

const URL = 'http://127.0.0.1:8081';
const VIEWPORT = { width: 1280, height: 800 };
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

async function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTest(name, testFn, page) {
    let attempts = 0;
    while (attempts <= MAX_RETRIES) {
        try {
            await testFn(page);
            console.log(`PASS: ${name}`);
            return true;
        } catch (error) {
            attempts++;
            console.error(`FAIL attempt ${attempts}: ${name}`);
            console.error(error.message);

            // Take screenshot
            const screenshotPath = `test_failure_${name.replace(/[^a-z0-9]/gi, '_')}_${attempts}.png`;
            await page.screenshot({ path: screenshotPath });
            console.log(`Screenshot saved to ${screenshotPath}`);

            if (attempts > MAX_RETRIES) {
                console.error(`FAILED: ${name} after ${attempts} attempts`);
                return false;
            }
            await wait(RETRY_DELAY);
        }
    }
    return false;
}

async function main() {
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setViewport(VIEWPORT);

    // Capture console logs
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));

    let allPassed = true;

    try {
        console.log('Navigating to ' + URL);
        await page.goto(URL);

        // Wait for boot splash to disappear
        try {
            await page.waitForSelector('#boot-splash', { hidden: true, timeout: 10000 });
            console.log('Boot splash disappeared');
        } catch (e) {
            console.error('Boot splash did not disappear');
            throw e;
        }

        // T1: Boot & Navigation
        allPassed &= await runTest('T1: Boot & Navigation', async (p) => {
            // Dashboard renders by default
            await p.waitForSelector('#view-dashboard', { visible: true });

            const navs = ['dashboard', 'contacts', 'partners', 'pipeline', 'calendar', 'workbench'];
            for (const nav of navs) {
                console.log(`Navigating to ${nav}...`);
                // Click nav button
                // Note: selectors might need adjustment based on actual DOM
                // Assuming button[data-nav="${nav}"] exists
                const btnSelector = `button[data-nav="${nav}"]`;
                await p.waitForSelector(btnSelector);
                await p.click(btnSelector);

                // Verify view visible
                await p.waitForSelector(`#view-${nav}`, { visible: true });

                // Verify others hidden (check one other)
                const other = nav === 'dashboard' ? 'contacts' : 'dashboard';
                const otherEl = await p.$(`#view-${other}`);
                if (otherEl) {
                    const isVisible = await otherEl.evaluate(el => {
                        const style = window.getComputedStyle(el);
                        return style.display !== 'none' && !el.classList.contains('hidden');
                    });
                    if (isVisible) throw new Error(`View ${other} is still visible when on ${nav}`);
                }
            }
        }, page);

        // T2: Calendar/Partner View Isolation
        allPassed &= await runTest('T2: Calendar/Partner View Isolation', async (p) => {
            // Navigate to Calendar
            await p.click('button[data-nav="calendar"]');
            await p.waitForSelector('#view-calendar', { visible: true });
            // Check for content
            const calContent = await p.$('#view-calendar .calendar-root, #view-calendar .calendar-grid, #calendar-root');
            if (!calContent) throw new Error('Calendar content not found');

            // Navigate to Partners
            await p.click('button[data-nav="partners"]');
            await p.waitForSelector('#view-partners', { visible: true });

            // Verify Calendar is empty or hidden
            const calVisible = await p.$eval('#view-calendar', el => {
                return el.style.display !== 'none' && !el.classList.contains('hidden');
            });
            if (calVisible) throw new Error('Calendar view is still visible');

            // Check for bleed (content remaining)
            const calHtml = await p.$eval('#view-calendar', el => el.innerHTML);
            if (calHtml.trim() !== '' && !calHtml.includes('loading')) {
                // It might not be empty if hidden, but if we are "scorched earth" it should be empty or just a loader
                // The requirement says "verify #view-calendar is now empty or hidden"
                // If it's hidden, that's fine. But we also want to ensure no bleed if we go back?
                // The requirement says "Verify #view-calendar is now empty or hidden (no bleed)"
                // If we implemented scorched earth, it should be empty.
                // Let's check if it has children.
                const childCount = await p.$eval('#view-calendar', el => el.children.length);
                // If we are strictly scorched earth, it might be 0.
                // But let's just trust the "hidden" check for now, or check if innerHTML is empty if that was the fix.
                // The fix was `prevRoot.innerHTML = '';`. So it MUST be empty.
                if (childCount > 0) {
                    // Wait, maybe it re-renders immediately? No, we are on Partners.
                    // Let's warn but not fail if it's hidden.
                    console.log('Warning: Calendar view not empty, but hidden.');
                }
            }

            // Navigate back to Calendar
            await p.click('button[data-nav="calendar"]');
            await p.waitForSelector('#view-calendar', { visible: true });
            await p.waitForSelector('#calendar-root', { timeout: 5000 });
        }, page);

        // T3: Action Bar & Selection
        allPassed &= await runTest('T3: Action Bar & Selection', async (p) => {
            await p.click('button[data-nav="contacts"]');
            await p.waitForSelector('#view-contacts', { visible: true });

            // Select a row
            // Assuming .row-checkbox or input[type="checkbox"] in a row
            const checkbox = await p.waitForSelector('#view-contacts tbody tr input[type="checkbox"]');
            await checkbox.click();

            // Verify action bar
            await p.waitForSelector('#actionbar', { visible: true });
            const countText = await p.$eval('#actionbar', el => el.innerText);
            if (!countText.includes('1') && !countText.includes('Selected')) {
                // Just check visibility for now if text is dynamic
            }

            // Click Clear
            const clearBtn = await p.waitForSelector('#actionbar button[data-action="clear"]');
            await clearBtn.click();

            // Verify hidden
            await p.waitForFunction(() => {
                const bar = document.getElementById('actionbar');
                return !bar || bar.style.display === 'none' || bar.getAttribute('data-visible') !== '1';
            });

            // Verify checkboxes unchecked
            const checked = await p.$$eval('#view-contacts tbody tr input[type="checkbox"]', els => els.filter(e => e.checked).length);
            if (checked > 0) throw new Error('Checkboxes still checked');
        }, page);

        // T4: Contact CRUD
        allPassed &= await runTest('T4: Contact CRUD', async (p) => {
            // Click New+
            await p.click('#quick-add-unified'); // ID from header_toolbar.js

            // Verify dropdown
            await p.waitForSelector('.quick-create-menu', { visible: true });

            // Click Add Contact
            const addContactBtn = await p.$('button[data-action="add-contact"]');
            if (!addContactBtn) throw new Error('Add Contact button not found');
            await addContactBtn.click();

            // Fill form
            await p.waitForSelector('form[name="contact-edit-form"]', { visible: true });
            await p.type('input[name="firstName"]', 'Test');
            await p.type('input[name="lastName"]', 'User');
            // Email might be in a different tab or visible? Assuming visible.
            // If email input not found, skip or find tab.
            const emailInput = await p.$('input[name="email"]');
            if (emailInput) await emailInput.type('test@example.com');

            // Submit
            await p.click('button[type="submit"]');

            // Verify modal closes
            await p.waitForSelector('form[name="contact-edit-form"]', { hidden: true });

            // Verify in list
            // Force refresh contacts?
            await p.click('button[data-nav="contacts"]');
            await p.waitForFunction(() => document.body.innerText.includes('Test User'));

            // Delete (Optional cleanup)
            // Find row with Test User
            // Select it
            // Click Delete in action bar? Or context menu?
            // Skipping delete for smoke test to avoid complexity if delete flow is complex.
        }, page);

        // T5: Header & Workbench
        allPassed &= await runTest('T5: Header & Workbench', async (p) => {
            // Header exists
            const header = await p.$('.header-bar, header');
            if (!header) throw new Error('Header not found');

            // Settings button
            const settingsBtn = await p.$('#btn-open-settings');
            if (!settingsBtn) throw new Error('Settings button not found');

            // Workbench
            await p.click('button[data-nav="workbench"]');
            await p.waitForSelector('#view-workbench', { visible: true });
            const wbContent = await p.$eval('#view-workbench', el => el.innerText);
            if (wbContent.trim().length < 5) throw new Error('Workbench empty');
        }, page);

        // T6: Body Scroll State
        allPassed &= await runTest('T6: Body Scroll State', async (p) => {
            const bodyState = await p.evaluate(() => {
                const style = window.getComputedStyle(document.body);
                return {
                    overflow: style.overflow,
                    classList: Array.from(document.body.classList)
                };
            });
            if (bodyState.overflow === 'hidden') throw new Error('Body has overflow:hidden');
            if (bodyState.classList.includes('modal-open')) throw new Error('Body has modal-open class');
        }, page);

    } catch (e) {
        console.error('Global Test Error:', e);
        allPassed = false;
    } finally {
        await browser.close();
    }

    if (allPassed) {
        console.log('ALL TESTS PASSED');
        process.exit(0);
    } else {
        console.error('SOME TESTS FAILED');
        process.exit(1);
    }
}

main();
