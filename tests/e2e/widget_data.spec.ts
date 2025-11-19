import { test, expect } from '@playwright/test';

const REQUIRED_WIDGET_KEYS = [
  'relOpportunities',
  'nurtureCandidates',
  'closingCandidates',
  'pipelineEvents',
  'attention',
  'timeline',
  'favorites'
];

test('dashboard widget data is available at boot', async ({ page }) => {
  await page.goto('/index.html?skipBootAnimation=1');
  await page.waitForSelector('#dashboard-focus');

  const result = await page.evaluate((keys) => {
    const data = (window as any).__WIDGET_DATA__;
    const undefinedKeys = Array.isArray(keys)
      ? keys.filter((key) => data && typeof data[key] === 'undefined')
      : [];
    return {
      hasData: !!data,
      keys: data ? Object.keys(data).sort() : [],
      undefinedKeys
    };
  }, REQUIRED_WIDGET_KEYS);

  expect(result.hasData).toBe(true);
  expect(result.keys).toEqual(expect.arrayContaining(REQUIRED_WIDGET_KEYS));
  expect(result.undefinedKeys).toEqual([]);
});
