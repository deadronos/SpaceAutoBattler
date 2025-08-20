import { test, expect } from '@playwright/test';
import path from 'path';

test('standalone root file loads and shows canvas + UI', async ({ page }) => {
  // Resolve file:// URL to repo-root standalone HTML using current working dir
  const rootHtml = path.resolve(process.cwd(), 'space_themed_autobattler_canvas_red_vs_blue_standalone.html');
  const url = 'file://' + rootHtml.replace(/\\/g, '/');

  await page.goto(url);

  // Expect a canvas with id world to be present
  const canvas = page.locator('#world');
  await expect(canvas).toHaveCount(1);

  // Expect the UI container to exist and be visible
  const ui = page.locator('#ui');
  await expect(ui).toBeVisible();

  // Quick sanity: ensure add buttons for Red and Blue ships exist
  await expect(page.locator('#addRed')).toHaveCount(1);
  await expect(page.locator('#addBlue')).toHaveCount(1);

  // Fail the test if any page errors occur during this short window
  const errors = [];
  page.on('pageerror', (err) => errors.push(err));

  // Wait a short time to let scripts run and ensure no immediate console errors
  await page.waitForTimeout(500);
  if (errors.length > 0) {
    throw new Error('Page had errors: ' + errors.map(e => e && e.message).join('; '));
  }
});
