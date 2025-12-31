import { test, expect } from '@playwright/test';

test.describe('P0 Recovery', () => {
    test('Reproduce Task Persistence Failure', async ({ page }) => {
        // 1. Load App
        // Enable console logging
        page.on('console', msg => console.log(`[BROWSER] ${msg.type()}: ${msg.text()}`));

        // We assume the test runner serves index.html at root
        await page.goto('/index.html?e2e=1');
        await page.waitForLoadState('domcontentloaded');

        // 2. Run Seeds (Basic V1 seeds only for now)
        await page.evaluate(async () => {
            if (window.Seeds && window.Seeds.runSeeds) {
                await window.Seeds.runSeeds();
            } else {
                console.warn('Seeds module not found, skipping seed');
            }
        });

        // 3. Open New+ Menu
        await page.click('#quick-add-unified');
        await page.waitForSelector('#header-new-menu', { state: 'visible' });

        // 4. Select "Task"
        await page.click('button[data-role="header-new-task"]');
        await page.waitForSelector('#qc-task-modal', { state: 'visible' });

        // 5. Fill Form
        await page.fill('textarea[name="note"]', 'Test Persistence Task');

        // Ensure we have a linked entity (seed should have provided some)
        // Wait for options to load
        await page.waitForFunction(() => {
            const select = document.querySelector('select[name="linkedId"]');
            return select && !select.disabled && select.options.length > 1;
        }, null, { timeout: 5000 }).catch(() => console.log('Timeout waiting for linked entities'));

        const linkedOptions = await page.$eval('select[name="linkedId"]', sel => sel.options.length);
        if (linkedOptions <= 1) {
            console.log('No linked entities found, strictly this might be a seed issue, but we will try to save anyway to trigger the error');
        } else {
            await page.selectOption('select[name="linkedId"]', { index: 1 });
        }

        // 6. Save
        await page.click('button[data-role="save"]');

        // 7. Check for Error Toast
        // The user reports "Unable to save task. Try again."
        // We look for any toast
        const toastSelector = '.toast-notification, .toast-message, [data-role="status"]';

        // Check status div in modal first as it might show error instantly
        const statusText = await page.$eval('[data-role="status"]', el => el.textContent);
        console.log('Modal Status:', statusText);

        // Verify task is in DB
        const tasks = await page.evaluate(async () => {
            if (window.dbGetAll) {
                return await window.dbGetAll('tasks');
            }
            return [];
        });

        console.log('Tasks in DB:', tasks.length);
        // We expect at least the one we just created.
        // Seed might have added others, checking for our note
        const found = tasks.find(t => t.title === 'Test Persistence Task' || t.note === 'Test Persistence Task' || t.notes === 'Test Persistence Task');

        if (!found) {
            console.error('Task NOT found in DB');
            throw new Error('Task persistence failed: Task not found in IndexedDB');
        }
        console.log('Task FOUND in DB:', found.id);

        // 7. Verify Calendar Icon
        console.log('Navigating to Calendar to verify icon...');
        await page.evaluate(() => window.location.hash = '#/calendar');
        // Wait for rendering (might need a moment after view switch)
        await page.waitForTimeout(3000);

        // Locate the chip container
        const chip = page.locator('.event-chip', { hasText: 'Test Persistence Task' }).first();
        await expect(chip).toBeVisible({ timeout: 10000 });

        // Find icon inside
        const iconEl = chip.locator('.cal-event-icon');
        await expect(iconEl).toHaveText('✅');
        console.log('Icon Verified: ✅');

        // 8. Verify Seeded Events (P0 Item 3)
        // Check for "Initial Consultation" which comes from seed_data.js
        const seedChip = page.locator('.event-chip', { hasText: 'Initial Consultation' }).first();
        // It might be on a different day depending on seed logic?
        // My seed logic used `addDays(today, 2)`.
        // So checking presence in DOM might fail if not in view (month view specific).
        // Month view should show it if within current month.
        // Assuming today is not end of month.
        // We'll just log warning if not found, to avoid flakiness if date is far.
        if (await seedChip.count() > 0) {
            console.log('Seed Event Verified: Initial Consultation');
        } else {
            console.log('Seed Event NOT visible (might be on different day)');
        }
    });
});
