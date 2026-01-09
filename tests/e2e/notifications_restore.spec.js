const { test, expect } = require('@playwright/test');

test.describe('Notifications Restore', () => {
    test('should persist notifications across workspace export/restore', async ({ page }) => {
        // 1. Visit app
        await page.goto('/');

        // Wait for app ready
        await page.waitForFunction(() => window.appReady === true, null, { timeout: 10000 }).catch(() => null);

        // 2. Create notification via API
        const testId = `notif-${Date.now()}`;
        await page.evaluate((id) => {
            if (window.Notifier && typeof window.Notifier.push === 'function') {
                window.Notifier.push({ id, title: 'Test Restore Notification', flow: 'restore' });
            } else {
                throw new Error('Notifier API not found');
            }
        }, testId);

        // Verify it exists in runtime
        const countBefore = await page.evaluate(() => window.Notifier ? window.Notifier.getCount() : 0);
        expect(countBefore).toBeGreaterThan(0);

        // 3. Export
        // We expect dbExportAll to include notifications from localStorage (our patch)
        const snapshot = await page.evaluate(async () => {
            return await window.dbExportAll();
        });

        expect(snapshot).toBeDefined();
        // Since we patched dbExportAll, it should have 'notifications' array from localStorage
        const notifs = snapshot.notifications;
        expect(Array.isArray(notifs)).toBe(true);

        const hasIt = notifs.some(n => n.id === testId);
        expect(hasIt).toBe(true, 'Export payload should contain the notification from localStorage');

        // 4. Wipe
        await page.evaluate(async () => {
            window.localStorage.removeItem('notifications:queue'); // clear storage
            if (window.Notifier) window.Notifier.clear(); // clear memory
            // We also clear IDB stores to simulate full wipe
            await window.dbRestoreAll(null, 'replace');
        });

        // Verify wiped
        const countWiped = await page.evaluate(() => window.Notifier ? window.Notifier.getCount() : 0);
        expect(countWiped).toBe(0);

        // 5. Restore
        // We pass the snapshot back. dbRestoreAll should write to localStorage AND hot-update Notifier
        await page.evaluate(async (data) => {
            await window.dbRestoreAll(data, 'replace');
        }, snapshot);

        // 6. Verify Restore
        // Our patch should have written to localStorage AND called replaceNotifications
        const countAfter = await page.evaluate(() => window.Notifier ? window.Notifier.getCount() : 0);
        expect(countAfter).toBeGreaterThan(0, 'Notifier should be hot-updated after restore');

        const stored = await page.evaluate(() => {
            const raw = localStorage.getItem('notifications:queue');
            return JSON.parse(raw || '[]');
        });
        const hasItStored = stored.some(n => n.id === testId);
        expect(hasItStored).toBe(true, 'LocalStorage should contain restored notification');
    });
});
