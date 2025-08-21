import { test, expect } from './fixtures.js';
import path from 'path';

// Note: shared fixtures (including `standaloneBase`) are provided by ./fixtures.js

test('standalone root file loads and shows canvas + UI', async ({ page, standaloneBase }) => {
  // Prefer the Playwright fixture-provided standaloneBase (HTTP server) when available.
  // Otherwise fall back to process.env.STANDALONE_BASE_URL or file:// (last resort).
  const baseFromEnv = process.env.STANDALONE_BASE_URL || null;
  const base = standaloneBase || baseFromEnv || null;
  let url;
  if (base) {
    url = `${base.replace(/\/$/, '')}/space_themed_autobattler_canvas_red_vs_blue_standalone.html`;
  } else {
    // fallback to file:// (less stable)
    const rootHtml = path.resolve(process.cwd(), 'space_themed_autobattler_canvas_red_vs_blue_standalone.html');
    url = 'file://' + rootHtml.replace(/\\/g, '/');
  }

  // Robust navigation with a larger timeout
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });

  // Ensure the main canvas is present and visible
  await page.waitForSelector('#world', { timeout: 5000 });
  const canvas = page.locator('#world');
  await expect(canvas).toHaveCount(1);

  // Ensure the UI container is visible
  await page.waitForSelector('#ui', { timeout: 5000 });
  const ui = page.locator('#ui');
  await expect(ui).toBeVisible();

  // Quick sanity: ensure add buttons for Red and Blue ships exist
  await expect(page.locator('#addRed')).toHaveCount(1);
  await expect(page.locator('#addBlue')).toHaveCount(1);

  // Fail the test if any page errors occur during this short window
  const errors = [];
  page.on('pageerror', (err) => errors.push(err));

  // Wait briefly to let scripts run and ensure no immediate console errors
  await page.waitForTimeout(500);
  if (errors.length > 0) {
    throw new Error('Page had errors: ' + errors.map(e => e && e.message).join('; '));
  }

  // Interact with the UI: click add buttons and assert game state updated
  const initialShips = await page.evaluate(() => (window.__GM && window.__GM.ships) ? window.__GM.ships.length : 0);
  await page.click('#addRed');
  await page.click('#addBlue');

  // wait a tick for handlers to push ships
  await page.waitForTimeout(200);

  const shipsAfter = await page.evaluate(() => (window.__GM && window.__GM.ships) ? window.__GM.ships.slice() : []);
  if (shipsAfter.length < initialShips + 2) {
    throw new Error('Expected ships to increase after clicks; before=' + initialShips + ' after=' + shipsAfter.length);
  }
  const last = shipsAfter[shipsAfter.length - 1];
  const secondLast = shipsAfter[shipsAfter.length - 2];
  if (!((last.team === 'blue' && secondLast.team === 'red') || (last.team === 'red' && secondLast.team === 'blue'))) {
    throw new Error('Unexpected teams for newly added ships: ' + JSON.stringify([secondLast && secondLast.team, last && last.team]));
  }
});
