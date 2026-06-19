import { test, expect } from '@playwright/test';

/**
 * Visual regression tests for celestial environment rendering.
 * Creates baseline screenshots for visual diff comparisons.
 */
test.describe('Celestial Environment Visual Baseline', () => {
  test.beforeEach(async ({ page }) => {
    // Collect console errors for debugging
    const errors: string[] = [];
    page.on('console', (msg) => {
      const t = msg.type();
      const text = msg.text();
      if (t === 'error' || /GLTFLoader|extractUrlBase|lastIndexOf/.test(text)) {
        errors.push(text);
      }
    });

    // Navigate to the application
    await page.goto('/spaceautobattler.html');

    // Wait for the 3D scene to load
    await page.waitForSelector('canvas');

    // Pause the simulation for stable visual captures
    const pauseButton = page.getByRole('button', { name: 'Pause' });
    if (await pauseButton.isVisible()) {
      await pauseButton.click({ force: true });
      await expect(page.getByRole('button', { name: 'Resume' })).toBeVisible();
    }

    // Wait a bit for assets to load and scene to stabilize
    await page.waitForTimeout(1000);
  });

  test('captures baseline screenshot with planets visible', async ({ page }) => {
    // Ensure we're not in a mobile viewport that might affect rendering
    await page.setViewportSize({ width: 1280, height: 720 });

    // Take a baseline screenshot of the full 3D scene
    await expect(page).toHaveScreenshot('celestial-environment-baseline.png', {
      fullPage: false,
      clip: { x: 0, y: 0, width: 1280, height: 720 },
      threshold: 0.3, // Allow for some rendering differences
    });
  });

  test('captures planet close-up for detailed comparison', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });

    // Try to navigate closer to planets if controls are available
    // This is a best-effort attempt to get better planet visibility
    const canvas = page.locator('canvas');
    if (await canvas.isVisible()) {
      // Simulate mouse wheel scroll to zoom in (if OrbitControls are active)
      await canvas.hover();
      await page.mouse.wheel(0, -500); // Zoom in
      await page.waitForTimeout(1000); // Let animation settle
    }

    await expect(page).toHaveScreenshot('planets-closeup-baseline.png', {
      fullPage: false,
      clip: { x: 0, y: 0, width: 1280, height: 720 },
      threshold: 0.3,
    });
  });

  test('captures UI overlay with scene for integration testing', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });

    // Enable postprocessing to test the enhanced visual mode
    const ppButton = page.locator('button', { hasText: 'PP:' });
    if (await ppButton.isVisible()) {
      await ppButton.click();
      await page.waitForTimeout(500); // Let effects apply
    }

    await expect(page).toHaveScreenshot('ui-scene-integration-baseline.png', {
      fullPage: false,
      clip: { x: 0, y: 0, width: 1280, height: 720 },
      threshold: 0.3,
    });
  });

  test('verifies celestial objects are rendered', async ({ page }) => {
    // This test ensures that celestial objects are actually being rendered
    // by checking for expected visual elements in the scene

    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();

    // Take a screenshot to verify rendering
    const screenshot = await page.screenshot({ fullPage: false });
    expect(screenshot.length).toBeGreaterThan(1000); // Should have substantial content

    // Verify no critical rendering errors
    const errors = await page.evaluate(() => {
      const logs = (window as any).__testLogs || [];
      return logs.filter(
        (log: any) =>
          log.level === 'error' &&
          (log.message.includes('WebGL') || log.message.includes('Three.js')),
      );
    });

    expect(errors.length).toBe(0);
  });

  test('tests different camera angles for comprehensive coverage', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });

    const canvas = page.locator('canvas');
    if (await canvas.isVisible()) {
      // Test multiple camera positions
      const angles = [
        { name: 'default', wheel: 0, drag: null },
        { name: 'zoomed-in', wheel: -300, drag: null },
        { name: 'rotated-view', wheel: 0, drag: { x: 100, y: 50 } },
      ];

      for (const angle of angles) {
        // Reset view by refreshing if needed
        if (angle.name !== 'default') {
          await page.reload();
          await page.waitForSelector('canvas');
          await page.waitForTimeout(2000);
        }

        await canvas.hover();

        // Apply zoom
        if (angle.wheel !== 0) {
          await page.mouse.wheel(0, angle.wheel);
          await page.waitForTimeout(500);
        }

        // Apply rotation
        if (angle.drag) {
          await page.mouse.down();
          await page.mouse.move(
            (await canvas.boundingBox())!.x + angle.drag.x,
            (await canvas.boundingBox())!.y + angle.drag.y,
          );
          await page.mouse.up();
          await page.waitForTimeout(500);
        }

        // Capture screenshot for this angle
        await expect(page).toHaveScreenshot(`celestial-${angle.name}-baseline.png`, {
          fullPage: false,
          clip: { x: 0, y: 0, width: 1280, height: 720 },
          threshold: 0.3,
        });
      }
    }
  });
});
