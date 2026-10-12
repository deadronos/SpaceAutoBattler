import { test, expect } from '@playwright/test';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * Per-preset visual sign-off capture for the graphics-quality presets (#651).
 *
 * Produces a matched, paused full-scene screenshot at 1280×720 for each of the
 * `low` / `medium` / `high` presets into `test/playwright/baselines/`
 * (`quality-<tier>-<project>.png`) so the controller can attach the per-tier
 * before/after images to the draft PR for human review. It also samples
 * requestAnimationFrame frame times per tier and logs the resulting FPS for the
 * PR's perf note.
 *
 * The preset is forced with `page.addInitScript` *before* `goto`, exactly as
 * `ao-visual-baseline.spec.ts` does for `__copilot_forceAmbientOcclusion` and
 * `star-visibility.spec.ts` does for `__copilot_forcePostprocessingMount`. The
 * UI store reads `window.__copilot_qualityPreset` at boot, so each capture
 * deterministically starts at a fixed preset; toggling it at runtime would not
 * rebuild the already-compiled tier-dependent materials.
 *
 * The star shader animates on wall-clock time, so two independent page loads
 * differ slightly even at the same preset. To keep the distinguishability gate
 * honest this spec also captures a duplicate `high` control and requires the
 * tier signal to clear the measured animation-noise floor.
 *
 * WebKit is skipped (headless WebKit throttles timers / fails WebGL rendering,
 * mirroring `ao-visual-baseline.spec.ts` and `shield-visual-baseline.spec.ts`).
 */

const VIEWPORT = { width: 1280, height: 720 } as const;
const BASELINE_DIR = path.join(process.cwd(), 'test', 'playwright', 'baselines');
const DEBUG_DIR = path.join(process.cwd(), 'test', 'playwright', 'debug');
const PAGE_URL = '/spaceautobattler.html?copilot_debug=1';

type QualityPreset = 'low' | 'medium' | 'high';

interface CaptureResult {
  path: string;
  fps: number;
}

/**
 * Load the app with the quality preset forced to `preset`, pause the simulation,
 * and write a full-scene screenshot into `dir`.
 *
 * @param {import('@playwright/test').Page} page - The Playwright page to drive.
 * @param {QualityPreset} preset - Value for `window.__copilot_qualityPreset`.
 * @param {string} dir - Destination directory for the screenshot.
 * @param {string} fileName - Screenshot file name (project suffix included).
 * @returns {Promise<CaptureResult>} Written path and sampled FPS.
 */
async function captureScene(
  page: import('@playwright/test').Page,
  preset: QualityPreset,
  dir: string,
  fileName: string,
): Promise<CaptureResult> {
  const label = fileName;
  page.on('pageerror', (err) => {
    console.error(`[quality-preset-visual-baseline] ${label} pageerror:`, err.message);
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.error(`[quality-preset-visual-baseline] ${label} console.error:`, msg.text());
    }
  });

  await page.setViewportSize(VIEWPORT);

  // Must run before `goto`: the UI store reads this during module boot.
  await page.addInitScript((forcedPreset: string) => {
    (window as unknown as { __copilot_qualityPreset?: string }).__copilot_qualityPreset =
      forcedPreset;
  }, preset);

  await page.goto(PAGE_URL);
  await page.waitForSelector('canvas');

  // Let assets settle before sampling frames.
  await page.waitForTimeout(1000);
  const fps = await sampleFps(page);

  // Pause the simulation for stable frames (see ao-visual-baseline).
  const pauseButton = page.getByRole('button', { name: 'Pause' });
  if (await pauseButton.isVisible()) {
    await pauseButton.click({ force: true });
    await expect(page.getByRole('button', { name: 'Resume' })).toBeVisible();
  }

  // Let the paused frame stabilize before capturing.
  await page.waitForTimeout(1000);

  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();

  const target = path.join(dir, fileName);
  await page.screenshot({
    path: target,
    fullPage: false,
    clip: { x: 0, y: 0, width: VIEWPORT.width, height: VIEWPORT.height },
  });
  return { path: target, fps };
}

/**
 * Sample average FPS from requestAnimationFrame over a fixed wall-clock window.
 *
 * @param {import('@playwright/test').Page} page - Page to sample.
 * @param {number} [durationMs=2500] - Observation window in milliseconds.
 * @returns {Promise<number>} Average frames per second, or 0 when unavailable.
 */
async function sampleFps(
  page: import('@playwright/test').Page,
  durationMs = 2500,
): Promise<number> {
  return page.evaluate(async (duration) => {
    return await new Promise<number>((resolve) => {
      const start = performance.now();
      let frames = 0;
      const tick = () => {
        frames += 1;
        const elapsed = performance.now() - start;
        if (elapsed >= duration) {
          resolve(elapsed > 0 ? frames / (elapsed / 1000) : 0);
          return;
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }, durationMs);
}

interface DiffStats {
  changedRatio: number;
  meanChannelDelta: number;
}

/**
 * Compare two PNGs, returning the fraction of changed pixels and the mean
 * per-pixel channel delta (max of R/G/B absolute differences).
 *
 * @param {string} aPath - First PNG path.
 * @param {string} bPath - Second PNG path.
 * @returns {Promise<DiffStats>} Diff statistics.
 */
async function diffStats(aPath: string, bPath: string): Promise<DiffStats> {
  const [aBuffer, bBuffer] = await Promise.all([fs.readFile(aPath), fs.readFile(bPath)]);
  const a = PNG.sync.read(aBuffer);
  const b = PNG.sync.read(bBuffer);
  expect(b.width).toBe(a.width);
  expect(b.height).toBe(a.height);

  const diff = new PNG({ width: a.width, height: a.height });
  const diffPixels = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: 0 });
  const pixelCount = a.width * a.height;

  let channelDeltaSum = 0;
  for (let i = 0; i < a.data.length; i += 4) {
    channelDeltaSum += Math.max(
      Math.abs(a.data[i]! - b.data[i]!),
      Math.abs(a.data[i + 1]! - b.data[i + 1]!),
      Math.abs(a.data[i + 2]! - b.data[i + 2]!),
    );
  }

  return {
    changedRatio: diffPixels / pixelCount,
    meanChannelDelta: channelDeltaSum / pixelCount,
  };
}

test.describe('Quality preset visual baseline (low / medium / high)', () => {
  test.beforeEach(() => {
    test.skip(
      test.info().project.name === 'webkit',
      'WebKit headless can throttle timers or fail WebGL rendering',
    );
  });

  test('captures per-preset full-scene screenshots and FPS', async ({ context }, testInfo) => {
    test.setTimeout(180_000);
    await fs.mkdir(BASELINE_DIR, { recursive: true });
    await fs.mkdir(DEBUG_DIR, { recursive: true });

    const projectName = testInfo.project.name.replace(/\s+/g, '-');
    const fileFor = (tier: QualityPreset) => `quality-${tier}-${projectName}.png`;

    const captures: Record<QualityPreset, CaptureResult> = {
      low: { path: '', fps: 0 },
      medium: { path: '', fps: 0 },
      high: { path: '', fps: 0 },
    };

    for (const tier of ['low', 'medium', 'high'] as const) {
      const page = await context.newPage();
      captures[tier] = await captureScene(page, tier, BASELINE_DIR, fileFor(tier));
      await page.close();
    }

    // Duplicate `high` capture measures the animation-noise floor across
    // independent page loads.
    const controlPage = await context.newPage();
    const control = await captureScene(
      controlPage,
      'high',
      DEBUG_DIR,
      `quality-high-control-${projectName}.png`,
    );
    await controlPage.close();

    const noise = await diffStats(captures.high.path, control.path);
    const highVsMedium = await diffStats(captures.high.path, captures.medium.path);
    const mediumVsLow = await diffStats(captures.medium.path, captures.low.path);
    const highVsLow = await diffStats(captures.high.path, captures.low.path);

    console.info(
      `[quality-preset-visual-baseline] animation noise (high control): changed=${noise.changedRatio.toFixed(4)} meanChannelDelta=${noise.meanChannelDelta.toFixed(3)}`,
    );
    console.info(
      `[quality-preset-visual-baseline] high vs medium: changed=${highVsMedium.changedRatio.toFixed(4)} meanChannelDelta=${highVsMedium.meanChannelDelta.toFixed(3)}`,
    );
    console.info(
      `[quality-preset-visual-baseline] medium vs low: changed=${mediumVsLow.changedRatio.toFixed(4)} meanChannelDelta=${mediumVsLow.meanChannelDelta.toFixed(3)}`,
    );
    console.info(
      `[quality-preset-visual-baseline] high vs low: changed=${highVsLow.changedRatio.toFixed(4)} meanChannelDelta=${highVsLow.meanChannelDelta.toFixed(3)}`,
    );
    console.info(
      `[quality-preset-visual-baseline] FPS low≈${captures.low.fps.toFixed(1)} medium≈${captures.medium.fps.toFixed(1)} high≈${captures.high.fps.toFixed(1)}`,
    );

    // The most visually distinct pair must clear the measured animation-noise
    // floor by a wide margin; if the tiers rendered identically the gate fails.
    expect(highVsLow.changedRatio).toBeGreaterThan(Math.max(noise.changedRatio * 1.5, 0.01));
    expect(highVsLow.meanChannelDelta).toBeGreaterThan(noise.meanChannelDelta * 1.25);
  });
});
