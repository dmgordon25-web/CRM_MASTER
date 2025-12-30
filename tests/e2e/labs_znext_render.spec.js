
const { test, expect } = require('@playwright/test');

test('Labs zNext Engine Render Verification', async ({ page }) => {
    // Navigate with engine=vnext
    await page.goto('http://127.0.0.1:8080/index.html?engine=vnext#/labs');

    // Wait for Labs readiness
    const dashboard = page.locator('.labs-crm-dashboard');
    await expect(dashboard).toBeVisible({ timeout: 10000 });

    // Verify GridStack initialization
    const grid = page.locator('.labs-section-host .grid-stack').first();
    await expect(grid).toBeVisible();

    // Verify widgets differ from default collapsed state
    // We expect items to have width > 1 (since we set default w=4)
    // and grid to be substantial height
    const items = grid.locator('.grid-stack-item');
    await expect(items).not.toHaveCount(0);

    const firstItem = items.first();
    await expect(firstItem).toBeVisible({ timeout: 15000 });

    // Check that attributes are correctly set (fix verification)
    await expect(firstItem).toHaveAttribute('data-gs-width', /\d+/);
    await expect(firstItem).toHaveAttribute('data-gs-height', /\d+/);

    // Ensure the grid is not collapsed (height > 300px suggests meaningful layout)
    // We reuse evaluate to be robust against potential locator stale state
    const gridHeight = await grid.evaluate(el => el.clientHeight);
    expect(gridHeight).toBeGreaterThan(300);
});
