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
 * The star shader animates on wall-clock time, so two independent page loads
 * differ slightly even without AO. To keep the gate honest this spec also
 * captures an **AO-off control pair** and requires the AO signal to clear the
 * measured animation-noise floor by a wide margin.
 *
 * It also samples requestAnimationFrame frame times with AO off vs on and logs
 * the resulting FPS for the PR's perf-budget note (the brief's proposed budget:
 * ≤ ~1.5 ms added GPU time at 1280×720, half-res). The exact GPU pass time can
 * be read from `N8AOPostPass.lastTime` after `enableDebugMode()`, but that
 * requires `EXT_disjoint_timer_query_webgl2`, which headless/software contexts
 * do not expose; the FPS delta plus the `r3f-perf` overlay cover the manual
 * sign-off instead.
 */

const VIEWPORT = { width: 1280, height: 720 } as const;
const BASELINE_DIR = path.join(process.cwd(), 'test', 'playwright', 'baselines');
const DEBUG_DIR = path.join(process.cwd(), 'test', 'playwright', 'debug');
const PAGE_URL = '/spaceautobattler.html?copilot_debug=1';

/** Minimum fraction of pixels that must change between AO-off and AO-on. */
const AO_SIGNAL_THRESHOLD = 0.3;

interface CaptureResult {
  path: string;
  fps: number;
}

/**
 * Load the app with AO forced to `forcedAo`, pause the simulation, and write a
 * full-scene screenshot into `dir`.
 *
 * @param {import('@playwright/test').Page} page - The Playwright page to drive.
 * @param {boolean} forcedAo - Value for `window.__copilot_forceAmbientOcclusion`.
 * @param {string} dir - Destination directory for the screenshot.
 * @param {string} fileName - Screenshot file name (project suffix included).
 * @returns {Promise<CaptureResult>} Written path and sampled FPS.
 */
async function captureScene(
  page: import('@playwright/test').Page,
  forcedAo: boolean,
  dir: string,
  fileName: string,
): Promise<CaptureResult> {
  const label = fileName;
  page.on('pageerror', (err) => {
    console.error(`[ao-visual-baseline] ${label} pageerror:`, err.message);
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.error(`[ao-visual-baseline] ${label} console.error:`, msg.text());
    }
  });

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

  // Let assets settle before sampling frames.
  await page.waitForTimeout(1000);
  const fps = await sampleFps(page);

  // Pause the simulation for stable frames (see celestial-visual-baseline).
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

test.describe('Ambient occlusion visual baseline (AO off vs on)', () => {
  test.beforeEach(() => {
    // AO needs a working WebGL context; WebKit headless throttles timers and
    // fails to render reliably (mirrors shield-visual-baseline.spec.ts).
    test.skip(
      test.info().project.name === 'webkit',
      'WebKit headless can throttle timers or fail WebGL rendering',
    );
  });

  test('captures AO-off and AO-on full-scene screenshots', async ({ context }, testInfo) => {
    test.setTimeout(120_000);
    await fs.mkdir(BASELINE_DIR, { recursive: true });
    await fs.mkdir(DEBUG_DIR, { recursive: true });

    const projectName = testInfo.project.name.replace(/\s+/g, '-');
    const aoOffFile = `ao-scene-ao-off-${projectName}.png`;
    const aoOnFile = `ao-scene-ao-on-${projectName}.png`;
    const controlFile = `ao-scene-ao-off-control-${projectName}.png`;

    const offPage = await context.newPage();
    const aoOff = await captureScene(offPage, false, BASELINE_DIR, aoOffFile);
    await offPage.close();

    // Second AO-off capture measures the animation-noise floor from the
    // wall-clock star shader across independent page loads.
    const controlPage = await context.newPage();
    const control = await captureScene(controlPage, false, DEBUG_DIR, controlFile);
    await controlPage.close();

    const onPage = await context.newPage();
    const aoOn = await captureScene(onPage, true, BASELINE_DIR, aoOnFile);
    await onPage.close();

    const noise = await diffStats(aoOff.path, control.path);
    const signalFromOff = await diffStats(aoOff.path, aoOn.path);
    const signalFromControl = await diffStats(control.path, aoOn.path);
    // Use the weaker of the two AO-off references so the gate is conservative.
    const signalRatio = Math.min(signalFromOff.changedRatio, signalFromControl.changedRatio);
    const signalMean = Math.min(signalFromOff.meanChannelDelta, signalFromControl.meanChannelDelta);

    const aoOffFps = (aoOff.fps + control.fps) / 2;
    const aoOnFps = aoOn.fps;
    const fpsDelta = aoOffFps - aoOnFps;
    // Positive value = milliseconds per frame added by enabling AO.
    const frameMsDelta = 1000 / aoOnFps - 1000 / aoOffFps;

    console.info(
      `[ao-visual-baseline] animation noise (AO-off control): changed=${noise.changedRatio.toFixed(4)} meanChannelDelta=${noise.meanChannelDelta.toFixed(3)}`,
    );
    console.info(
      `[ao-visual-baseline] AO signal (off vs on): changed=${signalRatio.toFixed(4)} meanChannelDelta=${signalMean.toFixed(3)}`,
    );
    console.info(
      `[ao-visual-baseline] FPS AO-off≈${aoOffFps.toFixed(1)} AO-on≈${aoOnFps.toFixed(1)} delta=${fpsDelta.toFixed(1)}fps (~${frameMsDelta.toFixed(2)}ms/frame added)`,
    );

    // Gate on a margin well above the measured animation-noise floor so the
    // test fails if AO is silently not applied. The control pair makes this
    // self-calibrating: if AO were a no-op, signal ≈ noise and the ratio would
    // approach 1. The absolute floor documents a sane minimum for a working AO.
    expect(signalRatio).toBeGreaterThan(AO_SIGNAL_THRESHOLD);
    expect(signalRatio).toBeGreaterThan(noise.changedRatio * 1.5);
    expect(signalMean).toBeGreaterThan(noise.meanChannelDelta * 1.5);
  });
});
