
import { test, expect } from '@playwright/test';

test.describe('Packet B: Seeding & Calendar Parity', () => {

    test('should seed full workflow data and verify calendar coverage', async ({ page }) => {
        // 1. Go to Settings to run seeds
        await page.goto('http://127.0.0.1:8080/#/settings');
        await page.waitForSelector('.settings-panel');

        // Find the seed trigger (assuming it's available or we run via console)
        // For reliability in this specific task, we'll invoke the global seeder if UI button not present,
        // but typically we'd click 'Data Tools' -> 'Seed Full Workflow' if wired.
        // Based on user request, we have a "Data Tools" section.

        // Inject seed call directly to ensure deterministic run
        await page.evaluate(async () => {
            // Import the module dynamically if needed, or rely on window exposure
            // Since seed_full.js is an ES module, we might need to expose it or reload.
            // However, app usually exposes `Seeds` or we can trigger via button if clean.

            // Let's try to find the button or inject
            // But first, let's just use the console injection for the seed if possible,
            // or assume the previous steps wired it up.
            // Actually, let's just import it in the context if module support allows, 
            // or easier: The previous 'Packet A' wired a button id="btn-seed-full-workflow-data".
            // We will try that first.
        });

        // Check if the button exists from Packet A work
        const seedBtn = page.locator('#btn-seed-full-workflow-data');
        if (await seedBtn.count() > 0) {
            await seedBtn.click();
            // Wait for extensive seeding
            await page.waitForTimeout(2000);
        } else {
            // Fallback: Manually trigger if button missing (should not be validation failure of THIS packet, but lets be robust)
            await page.evaluate(async () => {
                const mod = await import('./js/seed_full.js');
                await mod.runFullWorkflowSeed();
            });
            await page.waitForTimeout(2000);
        }

        // 2. Go to Calendar
        await page.goto('http://127.0.0.1:8080/#/calendar');
        await page.waitForSelector('.calendar-month-grid');

        // 3. Verify Legend
        const legend = page.locator('.calendar-legend');
        await expect(legend).toBeVisible();

        // Check specific legend items
        const expectedItems = [
            { label: 'Contact', icon: '👥' },
            { label: 'Partner', icon: '🤝' },
            { label: 'Task', icon: '✅' },
            { label: 'Nurture', icon: '📌' },
            { label: 'Milestone', icon: '⭐' }
        ];

        for (const item of expectedItems) {
            const chip = legend.locator(`.legend-chip:has-text("${item.label}")`);
            await expect(chip).toBeVisible();
            await expect(chip).toContainText(item.icon);
        }

        // 4. Verify rendered events for each type
        // We seeded events into the current month, so they should be visible.

        // Task
        const taskEvent = page.locator('.event-chip[data-category="task"]').first();
        await expect(taskEvent).toBeVisible();
        await expect(taskEvent.locator('.cal-event-icon')).toHaveText('✅');

        // Nurture
        const nurtureEvent = page.locator('.event-chip[data-category="nurture"]').first();
        await expect(nurtureEvent).toBeVisible();
        await expect(nurtureEvent.locator('.cal-event-icon')).toHaveText('📌');

        // Partner
        // Note: Partner events might be type='partner' or category='partner'
        // Our seed sets type='partner' -> category='partner'
        const partnerEvent = page.locator('.event-chip[data-category="partner"]').first();
        await expect(partnerEvent).toBeVisible();
        await expect(partnerEvent.locator('.cal-event-icon')).toHaveText('🤝');

        // Milestone (Deal)
        // Seeded as 'deal' which maps to 'milestone' via EVENT_CATEGORIES where key='deadline' or similar?
        // Wait, let's check calendar_impl logic. 
        // In seed: upsert('deals', ...) 
        // In calendar_impl: collectDealEvents -> type: 'milestone'
        // So we look for data-type="milestone" or category="milestone"
        // The render logic sets data-type from type.
        const milestoneEvent = page.locator('.event-chip[data-type="milestone"]').first();
        await expect(milestoneEvent).toBeVisible();
        await expect(milestoneEvent.locator('.cal-event-icon')).toHaveText('⭐');

        // Contact (Birthday/Anniversary)
        // Seeded birthdays/anniversaries buildAnnualEvents -> type='contact' or 'milestone'
        // In calendar_impl: Birthday -> field 'birthday', label 'Birthday'
        // metaForEvent uses tokens. 'Birthday' token -> meeting (contact) category?
        // Actually EVENT_CATEGORIES 'meeting' has token 'birthday'. 
        // So it might show as Contact/Meeting icon 👥 or similar.
        // Let's check if we have ANY contact event.
        // Birthday might be 'contact' type but category determined by meta.
        // If category is 'meeting' (Contact), icon is 👥.
        const contactEvent = page.locator('.event-chip[data-category="meeting"]').or(page.locator('.event-chip[data-type="contact"]')).first();
        await expect(contactEvent).toBeVisible();

        // 5. Verify mix
        // Just ensure total count is healthy
        const allEvents = page.locator('.event-chip');
        expect(await allEvents.count()).toBeGreaterThan(5);
    });
});
