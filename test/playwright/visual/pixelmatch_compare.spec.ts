import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

// derive __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.skip(({ browserName }) => browserName !== 'chromium', 'Chromium-only pixel diff');

test('compare canvas screenshot to baseline with pixelmatch tolerance', async ({ page }) => {
  const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8080/dist/spaceautobattler_standalone.html';
  await page.goto(BASE);
  const canvas = page.locator('canvas#world, canvas').first();
  await expect(canvas).toBeVisible();
  const screenshotBuffer = await canvas.screenshot();

  // baseline path created by Playwright snapshot run
  const baselineDir = path.join(__dirname, 'standalone_chromium_snapshot.spec.ts-snapshots');
  const baselineName = 'standalone-chromium-baseline-chromium-win32.png';
  const baselinePath = path.join(baselineDir, baselineName);
  if (!fs.existsSync(baselinePath)) {
    // If baseline is missing, write the current screenshot so the baseline can be committed
    fs.mkdirSync(baselineDir, { recursive: true });
    fs.writeFileSync(baselinePath, screenshotBuffer);
    test.info().annotations.push({ type: 'baseline-created', description: baselinePath });
    return;
  }

  const baselinePNG = PNG.sync.read(fs.readFileSync(baselinePath));
  const currentPNG = PNG.sync.read(screenshotBuffer);
  // ensure same dimensions
  expect(currentPNG.width).toBe(baselinePNG.width);
  expect(currentPNG.height).toBe(baselinePNG.height);

  const { width, height } = baselinePNG;
  const diff = new PNG({ width, height });
  const mismatched = pixelmatch(baselinePNG.data, currentPNG.data, diff.data, width, height, { threshold: 0.12 });

  const maxAllowed = Math.max(1, Math.floor(width * height * 0.0005)); // allow 0.05% pixels different
  if (mismatched > 0) {
    const outPath = path.join('test', 'playwright', 'artifacts', `pixel-diff-chromium-${Date.now()}.png`);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, PNG.sync.write(diff));
  }

  expect(mismatched).toBeLessThanOrEqual(maxAllowed);
});
