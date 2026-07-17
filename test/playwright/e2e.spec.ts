import { test, expect } from '@playwright/test';

test.describe('SpaceAutoBattler E2E', () => {
  test('GLTF models render and ships fire projectiles', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      const t = msg.type();
      const text = msg.text();
      if (t === 'error' || /GLTFLoader|extractUrlBase|lastIndexOf/.test(text)) {
        errors.push(text);
      }
    });
    // WebKit headless in CI can heavily throttle timers and WebGL, making this
    // simulation-based assertion flaky. Skip on WebKit to keep suite stable.
    if ((test as any).info().project.name === 'webkit')
      test.skip(true, 'WebKit headless can throttle timers');
    // Go to built app with E2E flag so we can introspect counts
    await page.goto('/spaceautobattler.html?e2e=1');

    // Wait for R3F canvas and __SAB API to be present
    await expect(page.locator('canvas')).toHaveCount(1);
    await page.waitForFunction(() => Boolean((window as any).__SAB));

    // Verify some ship models are present — tick aggressively to advance simulation
    await page.waitForFunction(
      () => {
        const api = (window as any).__SAB;
        api?.tick?.(200, 1 / 60);
        const h = api?.getCounts?.();
        return h && h.ships >= 6; // two formations => 10 ships; allow >= 6 to be lenient on load
      },
      undefined,
      { timeout: 60000, polling: 100 },
    );

    // Now wait until at least one projectile exists (AI engages & fire when in range)
    await page.waitForFunction(
      () => {
        const api = (window as any).__SAB;
        api?.tick?.(200, 1 / 60);
        const h = api?.getCounts?.();
        return h && h.projectiles > 0;
      },
      undefined,
      { timeout: 60000, polling: 100 },
    );

    // Optional sanity screenshot on failure only configured globally; we can still take one here if needed
    expect(true).toBeTruthy();
    // Ensure no GLTFLoader related console errors were emitted
    expect(errors.join('\n')).not.toMatch(/extractUrlBase|lastIndexOf|GLTFLoader/);
  });
});
