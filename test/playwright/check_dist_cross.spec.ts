import { test, expect } from '@playwright/test';

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8080/dist/spaceautobattler_standalone.html';

test.describe('Standalone dist cross-browser smoke', () => {
  test('loads standalone and shows canvas', async ({ page, browserName }) => {
    await page.goto(BASE);
    // ensure canvas is present
    const canvas = await page.locator('canvas#world, canvas').first();
    await expect(canvas).toBeVisible();
    // take a screenshot for visual inspection per browser
    await page.screenshot({ path: `test/playwright/artifacts/standalone_${browserName}.png`, fullPage: false });
  });
});
