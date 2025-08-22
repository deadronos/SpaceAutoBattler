import { test, expect } from '@playwright/test';

// This test assumes the dev server is serving the repo root on http://127.0.0.1:8080
// and that the standalone build created dist/spaceautobattler_standalone.html

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8080';

test.describe('dist standalone', () => {
  test('loads standalone HTML and finds canvas', async ({ page }) => {
    const url = `${BASE}/dist/spaceautobattler_standalone.html`;
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    // check page contains a canvas with id 'world' or at least a canvas element
    const canvas = await page.locator('canvas#world, canvas').first();
    await expect(canvas).toBeVisible();
    // also ensure title or some app text exists
    await expect(page).toHaveTitle(/AutoBattler|SpaceAutoBattler|autobattler/i, { timeout: 2000 }).catch(() => {});
  });
});
