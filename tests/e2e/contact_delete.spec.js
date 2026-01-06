const { test, expect } = require('@playwright/test');

test.describe('Contact Deletion', () => {
    test('bulk delete updates UI immediately', async ({ page }) => {
        const fs = require('fs');
        fs.writeFileSync('test_log.txt', ''); // Clear log
        page.on('console', msg => {
            const text = `[BROWSER] ${msg.text()}`;
            console.log(text);
            fs.writeFileSync('test_log.txt', text + '\n', { flag: 'a' });
        });
        // 1. Setup
        await page.goto('/index.html?e2e=1');
        await page.waitForSelector('#boot-splash', { state: 'hidden' });

        // Seed contacts
        await page.evaluate(async () => {
            const now = Date.now();
            // Clear existing contacts to prevent duplicates/confusion
            if (typeof window.dbClear === 'function') await window.dbClear('contacts');
            else if (typeof window.dbGetAll === 'function') {
                const all = await window.dbGetAll('contacts');
                for (const c of all) await window.dbDelete('contacts', c.id);
            }

            const contacts = [
                { id: 'del-1', first: 'Delete', last: 'Me1', email: 'del1@example.com', stage: 'Lead', status: 'New', createdAt: now + 1000 },
                { id: 'del-2', first: 'Delete', last: 'Me2', email: 'del2@example.com', stage: 'Lead', status: 'New', createdAt: now + 2000 },
                { id: 'del-3', first: 'Delete', last: 'Me3', email: 'del3@example.com', stage: 'Lead', status: 'New', createdAt: now + 3000 },
                { id: 'keep-1', first: 'Keep', last: 'Me', email: 'keep@example.com', stage: 'Lead', status: 'New', createdAt: now + 4000 }
            ];
            // Ensure DB helpers exist
            if (typeof window.dbBulkPut === 'function') {
                await window.dbBulkPut('contacts', contacts);
            } else if (window.db && window.db.bulkPut) {
                await window.db.bulkPut('contacts', contacts);
            } else {
                throw new Error('No DB helper found');
            }
            console.log('Seed complete. Count:', (await window.dbGetAll('contacts')).length);

            if (typeof window.renderAll === 'function') window.renderAll();
        });

        // 2. Go to Contacts
        console.log('Opening Contacts List...');
        // await page.evaluate(() => window.Contacts.open()); // INCORRECT: Opens modal
        const navBtn = page.locator('#main-nav button[data-nav="contacts"]');
        await expect(navBtn).toBeVisible();
        await navBtn.click();
        await expect(page.locator('#view-contacts')).toBeVisible();

        console.log('Contacts List opened. Waiting for rows...');

        // Debug DB state
        const dbCounts = await page.evaluate(async () => {
            return (await window.dbGetAll('contacts')).length;
        });
        console.log(`DB Contact Count: ${dbCounts}`);

        // Wait for rows
        await page.waitForSelector('tr[data-id^="del-"]', { timeout: 10000 });
        console.log('Rows found. Selecting...');
        await expect(page.locator('tr[data-id="del-1"]')).toBeVisible();
        await expect(page.locator('tr[data-id="del-2"]')).toBeVisible();
        await expect(page.locator('tr[data-id="del-3"]')).toBeVisible();

        // 3. Select rows to delete
        await page.locator('tr[data-id="del-1"] input[type="checkbox"]').check();
        await page.locator('tr[data-id="del-2"] input[type="checkbox"]').check();
        await page.locator('tr[data-id="del-3"] input[type="checkbox"]').check();

        // 4. Click Delete in Action Bar
        // Wait for action bar to appear (it should appear when selection > 0)
        const actionBar = page.locator('#actionbar');
        await expect(actionBar).toBeVisible();
        // Check if it has 'delete' button
        const deleteBtn = actionBar.locator('button[data-act="delete"]');
        await expect(deleteBtn).toBeVisible();

        // Mock confirm dialog
        await page.evaluate(() => {
            window.confirmAction = () => Promise.resolve(true);
            window.confirm = () => true;
        });

        await deleteBtn.click();

        // 5. Verify rows are gone immediately
        await expect(page.locator('tr[data-id="del-1"]')).toBeHidden();
        await expect(page.locator('tr[data-id="del-2"]')).toBeHidden();
        await expect(page.locator('tr[data-id="del-3"]')).toBeHidden();

        // Verify "Keep Me" is still there
        await expect(page.locator('tr[data-id="keep-1"]')).toBeVisible();

        // 6. Verify selection is cleared (Action bar hidden)
        await expect(actionBar).toBeHidden();

        // 7. Verify ghost edit prevention
        // Try to open deleted contact via console
        const result = await page.evaluate(async () => {
            try {
                // Assuming window.Contacts.open(id) calls openContactEditor
                // Note: open() might return null if blocked
                const res = await window.Contacts.open('del-1', { suppressErrorToast: true });
                return res;
            } catch (e) {
                return 'error: ' + e.message;
            }
        });
        expect(result).toBeNull();
    });
});
