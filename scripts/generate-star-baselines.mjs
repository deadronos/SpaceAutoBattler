import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const BASE_URL = process.env.E2E_BASE || 'http://localhost:8080/';
const BASELINE_DIR = path.resolve('./test/playwright/baselines');
const VIEWPORT = { width: 1280, height: 800 };

async function main() {
  if (!fs.existsSync(BASELINE_DIR)) fs.mkdirSync(BASELINE_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true, args: ['--disable-gpu', '--use-gl=swiftshader'] });
  const page = await browser.newPage({ viewport: VIEWPORT });
  try {
    const rotDeg = Number(process.env.STAR_ROT_DEG ?? -15);
    await page.addInitScript((d) => {
      try {
        window.__copilot_forcePostprocessingMount = true;
        window.__copilot_rotateCameraDeltaDeg = d;
      } catch { /* ignore */ }
    }, rotDeg);

    await page.goto(`${BASE_URL}spaceautobattler.html?copilot_debug=1`);

    // Wait for the star overlay used by tests to be present
    await page.waitForSelector('#copilot-star-screen-indicator', { timeout: 10000 });

    // Pause simulation if Pause button exists to stabilize frame
    const pauseButton = page.getByRole('button', { name: 'Pause' });
    if (await pauseButton.isVisible()) {
      await pauseButton.click();
      await page.waitForTimeout(200);
    }

    const canvas = page.locator('canvas');
    const baselinePath = path.join(BASELINE_DIR, 'star-occlusion.png');
    await canvas.screenshot({ path: baselinePath });
    console.log('Saved star occlusion baseline to', baselinePath);
  } finally {
    await page.close();
    await browser.close();
  }
}

main().catch((err) => {
  console.error('Failed to generate star baselines:', err && err.message ? err.message : err);
  process.exit(1);
});
