import { test, expect } from '@playwright/test';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * Visual sign-off capture for the N8AO ambient-occlusion pass (#646).
 *
 * Produces a matched pair of full-scene screenshots — AO forced off and AO
 * forced on — at the same viewport, camera, and (paused) simulation frame. The
 * pair is written to `test/playwright/baselines/` so the controller can attach
 * it to the draft PR for human visual review (ship grounding, 2048² shadow
 * contact, no haloing or washed-out colors).
 *
 * The override is applied with `page.addInitScript` *before* `goto`, exactly as
 * `star-visibility.spec.ts` does for `__copilot_forcePostprocessingMount`.
 * `Postprocessing` reads both flags during mount, so the pass is built with the
 * requested AO state; toggling them at runtime would not rebuild the composer.
 *
 * This spec captures artifacts rather than gating a pixel-perfect baseline:
 * the star shader animates over wall-clock time, so a strict before/after match
 * is not meaningful. The assertions only confirm both captures are valid and
 * that forcing AO changes the rendered frame.
 */

const VIEWPORT = { width: 1280, height: 720 } as const;
const BASELINE_DIR = path.join(process.cwd(), 'test', 'playwright', 'baselines');
const PAGE_URL = '/spaceautobattler.html?copilot_debug=1';

/**
 * Load the app with AO forced to `forcedAo`, pause the simulation, and write a
 * full-scene screenshot to `test/playwright/baselines/<fileName>`.
 *
 * @param {import('@playwright/test').Page} page - The Playwright page to drive.
 * @param {boolean} forcedAo - Value for `window.__copilot_forceAmbientOcclusion`.
 * @param {string} fileName - Baseline file name (project suffix included).
 * @returns {Promise<string>} Absolute path of the written screenshot.
 */
async function captureScene(
  page: import('@playwright/test').Page,
  forcedAo: boolean,
  fileName: string,
): Promise<string> {
  await page.setViewportSize(VIEWPORT);

  // Must run before `goto`: Postprocessing reads these during mount.
  await page.addInitScript((aoEnabled: boolean) => {
    (
      window as unknown as { __copilot_forcePostprocessingMount?: boolean }
    ).__copilot_forcePostprocessingMount = true;
    (
      window as unknown as { __copilot_forceAmbientOcclusion?: boolean }
    ).__copilot_forceAmbientOcclusion = aoEnabled;
  }, forcedAo);

  await page.goto(PAGE_URL);
  await page.waitForSelector('canvas');

  // Pause the simulation for stable frames (see celestial-visual-baseline).
  const pauseButton = page.getByRole('button', { name: 'Pause' });
  if (await pauseButton.isVisible()) {
    await pauseButton.click({ force: true });
    await expect(page.getByRole('button', { name: 'Resume' })).toBeVisible();
  }

  // Let assets settle and the paused frame stabilize before capturing.
  await page.waitForTimeout(1000);

  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();

  const target = path.join(BASELINE_DIR, fileName);
  await page.screenshot({
    path: target,
    fullPage: false,
    clip: { x: 0, y: 0, width: VIEWPORT.width, height: VIEWPORT.height },
  });
  return target;
}

test.describe('Ambient occlusion visual baseline (AO off vs on)', () => {
  test.beforeEach(async ({ page }) => {
    // AO needs a working WebGL context; WebKit headless throttles timers and
    // fails to render reliably (mirrors shield-visual-baseline.spec.ts).
    if (test.info().project.name === 'webkit') {
      test.skip(true, 'WebKit headless can throttle timers or fail WebGL rendering');
    }
    page.on('pageerror', (err) => {
      console.error('[ao-visual-baseline] pageerror:', err.message);
    });
  });

  test('captures AO-off and AO-on full-scene screenshots', async ({ context }, testInfo) => {
    await fs.mkdir(BASELINE_DIR, { recursive: true });

    const projectName = testInfo.project.name.replace(/\s+/g, '-');
    const aoOffFile = `ao-scene-ao-off-${projectName}.png`;
    const aoOnFile = `ao-scene-ao-on-${projectName}.png`;

    const offPage = await context.newPage();
    const offPath = await captureScene(offPage, false, aoOffFile);
    await offPage.close();

    const onPage = await context.newPage();
    const onPath = await captureScene(onPage, true, aoOnFile);
    await onPage.close();

    const [offBuffer, onBuffer] = await Promise.all([fs.readFile(offPath), fs.readFile(onPath)]);
    expect(offBuffer.length).toBeGreaterThan(1000);
    expect(onBuffer.length).toBeGreaterThan(1000);

    const offPng = PNG.sync.read(offBuffer);
    const onPng = PNG.sync.read(onBuffer);
    expect(onPng.width).toBe(offPng.width);
    expect(onPng.height).toBe(offPng.height);

    // Count every pixel that changed (threshold 0) and the mean channel delta.
    // The AO-off vs AO-on signal is broad but gradual, so a strict count plus
    // the mean delta is far more informative for the sign-off note than a
    // per-pixel color-distance threshold.
    const diff = new PNG({ width: offPng.width, height: offPng.height });
    const diffPixels = pixelmatch(offPng.data, onPng.data, diff.data, offPng.width, offPng.height, {
      threshold: 0,
    });
    const pixelCount = offPng.width * offPng.height;
    const diffRatio = diffPixels / pixelCount;

    let channelDeltaSum = 0;
    for (let i = 0; i < offPng.data.length; i += 4) {
      channelDeltaSum += Math.max(
        Math.abs(offPng.data[i]! - onPng.data[i]!),
        Math.abs(offPng.data[i + 1]! - onPng.data[i + 1]!),
        Math.abs(offPng.data[i + 2]! - onPng.data[i + 2]!),
      );
    }
    const meanChannelDelta = channelDeltaSum / pixelCount;
    console.info(
      `[ao-visual-baseline] AO-off vs AO-on: changed=${diffRatio.toFixed(4)} meanChannelDelta=${meanChannelDelta.toFixed(3)}`,
    );

    // Forcing AO must change the rendered frame. The magnitude is reported for
    // the sign-off note; the human reviews the pair for grounding/halos/color.
    expect(diffRatio).toBeGreaterThan(0);
    expect(meanChannelDelta).toBeGreaterThan(0);
  });
});
