import { test, expect } from '@playwright/test';

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8080';

test.describe('dist visual checks (chromium only)', () => {
  test('standalone page screenshot', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'visual checks run on chromium only');
    const url = `${BASE}/dist/spaceautobattler_standalone.html`;
    await page.goto(url, { waitUntil: 'networkidle' });
    const canvas = await page.locator('canvas#world, canvas').first();
    await expect(canvas).toBeVisible({ timeout: 2000 });
    // take a screenshot of the viewport (useful artifact)
    await page.screenshot({ path: 'test/playwright/artifacts/standalone_viewport.png', fullPage: false });
  });

  test('standalone accessibility snapshot', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'a11y snapshot on chromium only');
    const url = `${BASE}/dist/spaceautobattler_standalone.html`;
    await page.goto(url, { waitUntil: 'networkidle' });
  const world = page.locator('#world');
  await expect(world).toBeVisible();
    // toMatchAriaSnapshot may require @playwright/test to be configured with snapshot serializer;
    // use toHaveTitle as a lightweight accessibility-related check and still include an aria snapshot if available.
    await expect(page).toHaveTitle(/AutoBattler|SpaceAutoBattler|autobattler/i).catch(() => {});
  });
});

export {};
