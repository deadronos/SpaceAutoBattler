import { test, expect } from '@playwright/test';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const VIEWPORT = { width: 1280, height: 720 } as const;
const CAPTURE_DIR = path.resolve('playwright-debug');
const BEFORE_FILE = 'star-sphere-before.png';
const AFTER_FILE = 'star-sphere-after.png';

const LEGACY_OVERRIDES = {
  textureRadialPower: 1.6,
  coronaEdgeSoftness: 0.28,
  baseFillStrength: 0,
  coronaStrength: 0.75,
  outerGlowStrength: 0.55,
  alphaStrength: 0.6,
  textureMix: 0.4,
  timeMultiplier: 0,
};

test.describe('StarSphere before/after capture', () => {
  test('captures star sphere legacy and fuller-disc presets for documentation', async ({
    page,
    context,
  }) => {
    await fs.mkdir(CAPTURE_DIR, { recursive: true });
    const beforePath = path.join(CAPTURE_DIR, BEFORE_FILE);
    const afterPath = path.join(CAPTURE_DIR, AFTER_FILE);

    await test.step('Capture legacy preset screenshot with debug overrides', async () => {
      await page.setViewportSize(VIEWPORT);
      await page.addInitScript((overrides) => {
        (
          window as typeof window & {
            __STAR_DISK_DEBUG__?: { shaderOverrides?: typeof LEGACY_OVERRIDES };
          }
        ).__STAR_DISK_DEBUG__ = {
          shaderOverrides: overrides,
        };
      }, LEGACY_OVERRIDES);
      await page.goto('/spaceautobattler.html');
      await page.waitForLoadState('networkidle');
      const canvas = page.locator('canvas');
      await expect(canvas).toBeVisible();
      const pauseButton = page.getByRole('button', { name: 'Pause' });
      if (await pauseButton.isVisible()) {
        await pauseButton.click({ force: true });
        await expect(page.getByRole('button', { name: 'Resume' })).toBeVisible();
      }
      await expect
        .poll(() =>
          page.evaluate(() =>
            Boolean(
              (
                window as typeof window & {
                  __STAR_DISK_DEBUG__?: { shaderOverrides?: { textureRadialPower?: number } };
                }
              ).__STAR_DISK_DEBUG__?.shaderOverrides,
            ),
          ),
        )
        .toBeTruthy();
      await canvas.screenshot({ path: beforePath });
    });

    await page.close();

    const afterPage = await context.newPage();

    await test.step('Capture fuller-disc preset screenshot without overrides', async () => {
      await afterPage.setViewportSize(VIEWPORT);
      await afterPage.goto('/spaceautobattler.html');
      await afterPage.waitForLoadState('networkidle');
      const canvas = afterPage.locator('canvas');
      await expect(canvas).toBeVisible();
      const pauseButton = afterPage.getByRole('button', { name: 'Pause' });
      if (await pauseButton.isVisible()) {
        await pauseButton.click({ force: true });
        await expect(afterPage.getByRole('button', { name: 'Resume' })).toBeVisible();
      }
      await expect
        .poll(() =>
          afterPage.evaluate(() =>
            Boolean(
              (
                window as typeof window & {
                  __STAR_DISK_DEBUG__?: unknown;
                }
              ).__STAR_DISK_DEBUG__,
            ),
          ),
        )
        .toBeFalsy();
      await canvas.screenshot({ path: afterPath });
    });

    await afterPage.close();

    const [beforeBuffer, afterBuffer] = await Promise.all(
      [beforePath, afterPath].map((filePath) => fs.readFile(filePath)),
    );

    expect(beforeBuffer!.length).toBeGreaterThan(0);
    expect(afterBuffer!.length).toBeGreaterThan(0);
    expect(beforeBuffer!.equals(afterBuffer!)).toBe(false);
  });
});
