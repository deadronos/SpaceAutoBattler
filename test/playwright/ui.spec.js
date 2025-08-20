import { test, expect } from '@playwright/test';

// Base URL for the site under test. Set E2E_BASE to override.
const BASE = process.env.E2E_BASE || 'http://localhost:8080/space_themed_autobattler_canvas_red_vs_blue_standalone.html';

// Small helper to wait for likely interactive elements to appear
async function waitForUI(page) {
  await Promise.all([
    page.waitForSelector('#world', { state: 'attached', timeout: 5000 }),
    page.waitForSelector('#startPause', { state: 'attached', timeout: 5000 }),
    page.waitForSelector('#redScore', { state: 'attached', timeout: 5000 }),
    page.waitForSelector('#blueScore', { state: 'attached', timeout: 5000 }),
    page.waitForSelector('#stats', { state: 'attached', timeout: 5000 })
  ]);
}

test.describe('SpaceAutoBattler UI', () => {
  test('loads and displays core UI elements', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'networkidle' });

    // Wait for DOM elements we expect
    await waitForUI(page);

    // Basic assertions
    const canvas = await page.$('#world');
    expect(canvas).not.toBeNull();

    const startBtn = await page.$('#startPause');
    expect(startBtn).not.toBeNull();

    const redBadge = await page.$('#redScore');
    const blueBadge = await page.$('#blueScore');
    const stats = await page.$('#stats');
    expect(redBadge).not.toBeNull();
    expect(blueBadge).not.toBeNull();
    expect(stats).not.toBeNull();

    // Ensure stats text contains expected tokens
    const statsText = (await stats.innerText()).toLowerCase();
    expect(statsText).toMatch(/ships/);
    expect(statsText).toMatch(/bullets/);

    // Take a screenshot for manual inspection when running headed
    await page.screenshot({ path: 'test/playwright/ui-loaded.png', fullPage: false });
  });
});
