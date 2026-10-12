import { test, expect } from '@playwright/test';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * Visual sign-off capture for the deterministic explosion shake + FOV kick
 * (#647, Task 1).
 *
 * Produces a matched pair of full-scene screenshots — shake forced off
 * (`__copilot_forceCameraTrauma = 0`) and shake forced on
 * (`__copilot_forceCameraTrauma = 1`) — at the same viewport, camera, and
 * (paused) simulation frame. The pair is written to
 * `test/playwright/baselines/` so the controller can attach it to the draft PR
 * for human visual review (shake is readable but bounded, and the off frame is
 * unchanged).
 *
 * The override is applied with `page.addInitScript` *before* `goto`, exactly as
 * `ao-visual-baseline.spec.ts` does for `__copilot_forceAmbientOcclusion`.
 * `<CameraRig />` reads the flag during mount, so the rig holds the requested
 * constant trauma from the first frame; with the sim paused the noise sample is
 * frozen, giving a stable, reproducible offset.
 *
 * The star shader animates on wall-clock time, so two independent page loads
 * differ slightly even with shake off. To keep the gate honest this spec also
 * captures a shake-off control pair and requires the shake signal to clear the
 * measured animation-noise floor by a margin.
 */

const VIEWPORT = { width: 1280, height: 720 } as const;
const BASELINE_DIR = path.join(process.cwd(), 'test', 'playwright', 'baselines');
const DEBUG_DIR = path.join(process.cwd(), 'test', 'playwright', 'debug');
const PAGE_URL = '/spaceautobattler.html?copilot_debug=1';

/** Minimum fraction of pixels that must change between shake-off and shake-on. */
const SHAKE_SIGNAL_THRESHOLD = 0.05;
/** Minimum fraction of pixels that must change between follow-off and follow-on. */
const FOLLOW_SIGNAL_THRESHOLD = 0.02;
/** Ship id forced for the deterministic follow capture (first spawned ship). */
const FOLLOW_SHIP_ID = 1;

/**
 * Load the app with camera trauma forced to `forcedTrauma`, pause the
 * simulation, and write a full-scene screenshot into `dir`.
 *
 * @param {import('@playwright/test').Page} page - The Playwright page to drive.
 * @param {0 | 1} forcedTrauma - Value for `window.__copilot_forceCameraTrauma`.
 * @param {string} dir - Destination directory for the screenshot.
 * @param {string} fileName - Screenshot file name (project suffix included).
 * @param {number} [forcedFollowId] - Optional ship id for
 *   `window.__copilot_forceCameraFollowId` (forces deterministic follow).
 * @returns {Promise<string>} The written screenshot path.
 */
async function captureScene(
  page: import('@playwright/test').Page,
  forcedTrauma: 0 | 1,
  dir: string,
  fileName: string,
  forcedFollowId?: number,
): Promise<string> {
  page.on('pageerror', (err) => {
    console.error(`[camera-rig-visual] ${fileName} pageerror:`, err.message);
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.error(`[camera-rig-visual] ${fileName} console.error:`, msg.text());
    }
  });

  await page.setViewportSize(VIEWPORT);

  // Pin the capture environment so `prefers-reduced-motion` cannot silently
  // suppress follow smoothing (which would make the follow-on frame a no-op and
  // fail the self-calibrating gate). Mirrors a deterministic desktop default.
  await page.emulateMedia({ reducedMotion: 'no-preference' });

  // Must run before `goto`: `<CameraRig />` reads these during mount.
  await page.addInitScript(
    (opts: { trauma: number; followId?: number }) => {
      const debugWin = window as unknown as {
        __copilot_forceCameraTrauma?: number;
        __copilot_forceCameraFollowId?: number;
      };
      debugWin.__copilot_forceCameraTrauma = opts.trauma;
      if (opts.followId !== undefined) {
        debugWin.__copilot_forceCameraFollowId = opts.followId;
      }
    },
    { trauma: forcedTrauma, followId: forcedFollowId },
  );

  await page.goto(PAGE_URL);
  await page.waitForSelector('canvas');

  // Let assets settle before capturing.
  await page.waitForTimeout(1000);

  // Pause the simulation for stable frames (see ao-visual-baseline).
  const pauseButton = page.getByRole('button', { name: 'Pause' });
  if (await pauseButton.isVisible()) {
    await pauseButton.click({ force: true });
    await expect(page.getByRole('button', { name: 'Resume' })).toBeVisible();
  }

  // Let the paused frame stabilize before capturing.
  await page.waitForTimeout(1000);

  // Follow retargets over real time, so give it extra frames to glide once the
  // simulation is paused.
  if (forcedFollowId !== undefined) {
    await page.waitForTimeout(1500);
  }

  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();

  const target = path.join(dir, fileName);
  await page.screenshot({
    path: target,
    fullPage: false,
    clip: { x: 0, y: 0, width: VIEWPORT.width, height: VIEWPORT.height },
  });
  return target;
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

test.describe('Camera rig shake visual baseline (shake off vs on)', () => {
  test.beforeEach(() => {
    // Shake needs a working WebGL context; WebKit headless throttles timers and
    // fails to render reliably (mirrors ao-visual-baseline.spec.ts).
    test.skip(
      test.info().project.name === 'webkit',
      'WebKit headless can throttle timers or fail WebGL rendering',
    );
  });

  test('captures shake-off and shake-on full-scene screenshots', async ({ context }, testInfo) => {
    test.setTimeout(120_000);
    await fs.mkdir(BASELINE_DIR, { recursive: true });
    await fs.mkdir(DEBUG_DIR, { recursive: true });

    const projectName = testInfo.project.name.replace(/\s+/g, '-');
    const shakeOffFile = `camera-rig-shake-off-${projectName}.png`;
    const shakeOnFile = `camera-rig-shake-on-${projectName}.png`;
    const controlFile = `camera-rig-shake-off-control-${projectName}.png`;

    const offPage = await context.newPage();
    const shakeOff = await captureScene(offPage, 0, BASELINE_DIR, shakeOffFile);
    await offPage.close();

    // Second shake-off capture measures the animation-noise floor from the
    // wall-clock star shader across independent page loads.
    const controlPage = await context.newPage();
    const control = await captureScene(controlPage, 0, DEBUG_DIR, controlFile);
    await controlPage.close();

    const onPage = await context.newPage();
    const shakeOn = await captureScene(onPage, 1, BASELINE_DIR, shakeOnFile);
    await onPage.close();

    const noise = await diffStats(shakeOff, control);
    const signalFromOff = await diffStats(shakeOff, shakeOn);
    const signalFromControl = await diffStats(control, shakeOn);
    // Use the weaker of the two shake-off references so the gate is conservative.
    const signalRatio = Math.min(signalFromOff.changedRatio, signalFromControl.changedRatio);
    const signalMean = Math.min(signalFromOff.meanChannelDelta, signalFromControl.meanChannelDelta);

    console.info(
      `[camera-rig-visual] animation noise (shake-off control): changed=${noise.changedRatio.toFixed(4)} meanChannelDelta=${noise.meanChannelDelta.toFixed(3)}`,
    );
    console.info(
      `[camera-rig-visual] shake signal (off vs on): changed=${signalRatio.toFixed(4)} meanChannelDelta=${signalMean.toFixed(3)}`,
    );

    // Gate on a margin well above the measured animation-noise floor so the
    // test fails if the shake is silently not applied. The control pair makes
    // this self-calibrating: if shake were a no-op, signal ≈ noise.
    expect(signalRatio).toBeGreaterThan(SHAKE_SIGNAL_THRESHOLD);
    expect(signalRatio).toBeGreaterThan(noise.changedRatio * 1.5);
    expect(signalMean).toBeGreaterThan(noise.meanChannelDelta * 1.5);
  });

  test('captures follow-off and follow-on full-scene screenshots', async ({
    context,
  }, testInfo) => {
    test.setTimeout(120_000);
    await fs.mkdir(BASELINE_DIR, { recursive: true });
    await fs.mkdir(DEBUG_DIR, { recursive: true });

    const projectName = testInfo.project.name.replace(/\s+/g, '-');
    const followOffFile = `camera-rig-follow-off-${projectName}.png`;
    const followOnFile = `camera-rig-follow-on-${projectName}.png`;
    const controlFile = `camera-rig-follow-off-control-${projectName}.png`;

    const offPage = await context.newPage();
    const followOff = await captureScene(offPage, 0, BASELINE_DIR, followOffFile);
    await offPage.close();

    // Second follow-off capture measures the wall-clock star-shader noise floor.
    const controlPage = await context.newPage();
    const control = await captureScene(controlPage, 0, DEBUG_DIR, controlFile);
    await controlPage.close();

    // `__copilot_forceCameraFollowId` forces follow of the first spawned ship,
    // independent of the UI toggle/selection, for a deterministic capture.
    const onPage = await context.newPage();
    const followOn = await captureScene(onPage, 0, BASELINE_DIR, followOnFile, FOLLOW_SHIP_ID);
    await onPage.close();

    const noise = await diffStats(followOff, control);
    const signalFromOff = await diffStats(followOff, followOn);
    const signalFromControl = await diffStats(control, followOn);
    const signalRatio = Math.min(signalFromOff.changedRatio, signalFromControl.changedRatio);
    const signalMean = Math.min(signalFromOff.meanChannelDelta, signalFromControl.meanChannelDelta);

    console.info(
      `[camera-rig-visual] follow noise (off control): changed=${noise.changedRatio.toFixed(4)} meanChannelDelta=${noise.meanChannelDelta.toFixed(3)}`,
    );
    console.info(
      `[camera-rig-visual] follow signal (off vs on): changed=${signalRatio.toFixed(4)} meanChannelDelta=${signalMean.toFixed(3)}`,
    );

    // Self-calibrating gate: if follow were a no-op, signal ≈ noise.
    expect(signalRatio).toBeGreaterThan(FOLLOW_SIGNAL_THRESHOLD);
    expect(signalRatio).toBeGreaterThan(noise.changedRatio * 1.5);
    expect(signalMean).toBeGreaterThan(noise.meanChannelDelta * 1.5);
  });
});
