import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

// Baseline and debug directories
const baselineDir = path.join(__dirname, 'baselines');
const debugDir = path.join(__dirname, 'debug');
if (!fs.existsSync(baselineDir)) fs.mkdirSync(baselineDir, { recursive: true });
if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir, { recursive: true });

// Hulls to validate
const HULLS_TO_TEST = ['fighter', 'frigate', 'carrier'];

// Helper to build test page URL
function buildUrl(hull: string, pp: boolean) {
  const params = new URLSearchParams({ hull, shield: 'true', postprocessing: String(pp) });
  return `/test/playwright/pages/ship-renderer.html?${params.toString()}`;
}

// Basic setup
test.describe('Shield visual baseline (postprocessing on/off)', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.error('Browser console error:', msg.text());
    });
  });

  for (const hull of HULLS_TO_TEST) {
    test(`captures shield screenshot for ${hull} (PP off)`, async ({ page }) => {
      await page.goto(buildUrl(hull, false));
      await page.waitForSelector('#canvas');
      await page.waitForTimeout(1500);
      const canvas = page.locator('#canvas');
      const baselineName = `shield-${hull}-pp-off.png`;
      const baselinePath = path.join(baselineDir, baselineName);

      if (fs.existsSync(baselinePath)) {
        await expect(canvas).toHaveScreenshot(baselineName, { maxDiffPixelRatio: 0.06, threshold: 0.25 });
      } else {
        await canvas.screenshot({ path: baselinePath });
        console.log(`Generated baseline: ${baselinePath}`);
      }
    });

    test(`captures shield screenshot for ${hull} (PP on)`, async ({ page }) => {
      await page.goto(buildUrl(hull, true));
      await page.waitForSelector('#canvas');
      await page.waitForTimeout(1500);
      const canvas = page.locator('#canvas');
      const baselineName = `shield-${hull}-pp-on.png`;
      const baselinePath = path.join(baselineDir, baselineName);

      if (fs.existsSync(baselinePath)) {
        await expect(canvas).toHaveScreenshot(baselineName, { maxDiffPixelRatio: 0.06, threshold: 0.25 });
      } else {
        await canvas.screenshot({ path: baselinePath });
        console.log(`Generated baseline: ${baselinePath}`);
      }
    });

    test(`verifies shield scene summary for ${hull} (PP on)`, async ({ page }) => {
      await page.goto(buildUrl(hull, true));
      await page.waitForSelector('#canvas');
      await page.waitForTimeout(1200);

      // Use the page's test API (if available) to collect scene summary
      const summary = await page.evaluate(async () => {
        if ((window as any).__TEST__ && typeof (window as any).__TEST__.getSceneSummary === 'function') {
          return await (window as any).__TEST__.getSceneSummary();
        }
        return null;
      });

      // If we can introspect, perform guard checks.
      if (summary) {
        // Expect that shields are enabled and some material has 'shield' in name
        const hasShieldMesh = (summary.meshes || []).some((m: any) => (m.name || '').toLowerCase().includes('shield'));
        const hasShieldUniform = summary.uniforms && typeof summary.uniforms.uOpacity !== 'undefined';
        expect(hasShieldMesh || hasShieldUniform).toBe(true);
      } else {
        // No introspection available; fallback: ensure canvas has content
        const screenshot = await page.screenshot({ fullPage: false });
        expect(screenshot.length).toBeGreaterThan(1000);
      }
    });
  }
});
