import { test, expect } from '@playwright/test';

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8080';

test.describe('reinforcements UI (dist standalone)', () => {
  test('shows reinforcement summary when manager emits reinforcements (dist)', async ({ page }) => {
    const url = `${BASE}/spaceautobattler_standalone.html`;
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    const stats = page.locator('#stats');
    await stats.waitFor({ state: 'attached', timeout: 5000 });
    await expect(stats).toBeVisible();

    // Try to enable continuous and reduce interval if APIs are exposed on window.gm
    await page.evaluate(() => {
      try { (window as any).gm && (window as any).gm.setContinuousEnabled && (window as any).gm.setContinuousEnabled(true); } catch (e) {}
      try { (window as any).gm && (window as any).gm.setReinforcementInterval && (window as any).gm.setReinforcementInterval(0.01); } catch (e) {}
      try { (window as any).gm && (window as any).gm.stepOnce && (window as any).gm.stepOnce(0.02); } catch (e) {}
    });

    // Give the page up to 5s to display the reinforcement summary. Poll the
    // #stats element for the expected text instead of a fixed short sleep so
    // the test is more robust in CI and on slower machines.
    await page.waitForFunction(() => {
      const el = document.querySelector('#stats');
      return el && /Reinforcements: spawned/.test((el as HTMLElement).innerText);
    }, null, { timeout: 5000 });

    const statsText = await page.locator('#stats').innerText();
    expect(statsText).toMatch(/Reinforcements: spawned/);
  });
});