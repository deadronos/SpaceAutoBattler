import { test, expect } from '@playwright/test';

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8080';

test.describe('reinforcements UI', () => {
  test('shows reinforcement summary when manager emits reinforcements', async ({ page }) => {
    const url = `${BASE}/src/ui.html`;
    await page.goto(url, { waitUntil: 'domcontentloaded' });

  // Ensure stats element exists in the DOM and is attached. We'll use the
  // explicit #stats ID to avoid flaky text-matching during initial page
  // load when content may be updated shortly after DOMContentLoaded.
  const stats = page.locator('#stats');
  await stats.waitFor({ state: 'attached', timeout: 5000 });
  await expect(stats).toBeVisible();

    // Enable continuous checkbox if present
    const continuous = page.locator('#continuousCheckbox');
    if (await continuous.count() > 0) {
      // click to enable
      await continuous.check();
      // Ensure manager continuous mode is enabled even if the UI event
      // listener hasn't been wired yet by the page's main script.
      await page.evaluate(() => {
        try { (window as any).gm && (window as any).gm.setContinuousEnabled && (window as any).gm.setContinuousEnabled(true); } catch (e) {}
      });
    } else {
      // fallback: set via window.gm if exposed
      await page.evaluate(() => {
        try { (window as any).gm && (window as any).gm.setContinuousEnabled && (window as any).gm.setContinuousEnabled(true); } catch (e) {}
      });
    }

    // Reduce reinforcement interval if API available
    await page.evaluate(() => {
      try { (window as any).gm && (window as any).gm.setReinforcementInterval && (window as any).gm.setReinforcementInterval(0.01); } catch (e) {}
    });

    // Trigger one manager step by calling stepOnce if available
    await page.evaluate(() => {
      try { (window as any).gm && (window as any).gm.stepOnce && (window as any).gm.stepOnce(0.02); } catch (e) {}
    });

    // Wait briefly for UI to update and look for reinforcement summary text
    await page.waitForTimeout(200);

    // The UI appends reinforcement summaries to the #stats element text
    const statsText = await page.locator('#stats').innerText();
    expect(statsText).toMatch(/Reinforcements: spawned/);
  });
});
