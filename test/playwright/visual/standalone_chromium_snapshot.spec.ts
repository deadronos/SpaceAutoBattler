import { test, expect } from '@playwright/test';

test.describe('Chromium-only visual snapshot', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'Chromium-only snapshot test');

  test('standalone canvas matches baseline', async ({ page }) => {
    const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8080/dist/spaceautobattler_standalone.html';
    await page.goto(BASE);
    const canvas = await page.locator('canvas#world, canvas').first();
    await expect(canvas).toBeVisible();
    const image = await canvas.screenshot();
    // Use Playwright snapshot matching (binary)
    expect(image).toMatchSnapshot('standalone_chromium_baseline.png');
  });
});
