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

  // Interact with the UI: click add buttons and assert game state updated
  // Ensure initial ships array exists
  const initialShips = await page.evaluate(() => (window.__GM && window.__GM.ships) ? window.__GM.ships.length : 0);

  // Click addRed and addBlue
  await page.click('#addRed');
  await page.click('#addBlue');

  // wait a tick for handlers to push ships
  await page.waitForTimeout(100);

  const shipsAfter = await page.evaluate(() => (window.__GM && window.__GM.ships) ? window.__GM.ships.slice() : []);
  // Expect at least two more ships than initial
  if (shipsAfter.length < initialShips + 2) {
    throw new Error('Expected ships to increase after clicks; before=' + initialShips + ' after=' + shipsAfter.length);
  }
  // check the last two ships teams
  const last = shipsAfter[shipsAfter.length - 1];
  const secondLast = shipsAfter[shipsAfter.length - 2];
  if (!((last.team === 'blue' && secondLast.team === 'red') || (last.team === 'red' && secondLast.team === 'blue'))) {
    throw new Error('Unexpected teams for newly added ships: ' + JSON.stringify([secondLast && secondLast.team, last && last.team]));
  }
});
