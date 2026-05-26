import { test, expect } from '@playwright/test';

const VIEWPORT = { width: 1280, height: 720 } as const;

test.describe('Star occlusion', () => {
  test('a planet should occlude the star when camera rotated into alignment', async ({ page }) => {
    await page.setViewportSize(VIEWPORT);
    await page.goto('/spaceautobattler.html?copilot_debug=1');

    // Wait for the star debug overlay that provides the projected screen position
    await page.waitForSelector('#copilot-star-screen-indicator', { timeout: 5000 });

    // Pause simulation to make results deterministic
    const pauseButton = page.getByRole('button', { name: 'Pause' });
    if (await pauseButton.isVisible()) {
      await pauseButton.click();
      await expect(page.getByRole('button', { name: 'Resume' })).toBeVisible();
    }

    // Read the star screen position from the debug overlay
    const starPos = await page.evaluate(() => {
      const el = document.getElementById('copilot-star-screen-indicator');
      if (!el) return null;
      const attr = el.getAttribute('data-copilot-screen-pos');
      if (!attr) return null;
      const parts = attr.split(',').map((p) => Number(p));
      if (parts.length < 2) return null;
      return { x: parts[0], y: parts[1] };
    });

    expect(starPos).not.toBeNull();

    // Helper to probe a small grid around the star projection and detect
    // any darker pixel (planet occlusion). Returns true if found.
    const probeForDarkPixel = async (pxX: number, pxY: number, radius = 120, step = 6) => {
      return await page.evaluate(
        async (args: { cx: number; cy: number; r: number; s: number }) => {
          try {
            const { cx, cy, r, s } = args;
            const canvas = document.querySelector('canvas');
            if (!canvas) return false;
            const clientW = (canvas as HTMLCanvasElement).clientWidth || canvas.width || 1;
            const dpr =
              (canvas as HTMLCanvasElement).width / clientW || window.devicePixelRatio || 1;
            const deviceX = Math.floor(cx * dpr);
            const deviceY = Math.floor((canvas as HTMLCanvasElement).height - 1 - cy * dpr);
            const gl =
              (canvas as HTMLCanvasElement).getContext('webgl') ||
              (canvas as HTMLCanvasElement).getContext('webgl2');
            if (!gl) return false;

            const buffer = new Uint8Array(4);
            // Luminance helper
            const lum = (rr: number, gg: number, bb: number) =>
              0.2126 * rr + 0.7152 * gg + 0.0722 * bb;

            for (let dx = -r; dx <= r; dx += s) {
              for (let dy = -r; dy <= r; dy += s) {
                const x = deviceX + dx;
                const y = deviceY + dy;
                if (
                  x < 0 ||
                  y < 0 ||
                  x >= (canvas as HTMLCanvasElement).width ||
                  y >= (canvas as HTMLCanvasElement).height
                )
                  continue;
                try {
                  gl.readPixels(
                    x,
                    y,
                    1,
                    1,
                    (gl as any).RGBA || 0x1908,
                    (gl as any).UNSIGNED_BYTE || 0x1401,
                    buffer,
                  );
                } catch {
                  continue;
                }
                const r0 = buffer![0]!;
                const g0 = buffer![1]!;
                const b0 = buffer![2]!;
                const a0 = buffer![3]!;
                const l = lum(r0, g0, b0);
                // Treat low-luminance pixels as occluders (planet/ship dark)
                if (a0 > 0 && l < 40) {
                  return true;
                }
              }
            }
            return false;
          } catch {
            return false;
          }
        },
        { cx: pxX, cy: pxY, r: radius, s: step },
      );
    };

    // Try rotating the camera by several deltas until we detect an occluding pixel.
    const rotationCandidates = [-35, -25, -15, -10, 0, 10, 15, 25, 35];
    let occluded = false;

    for (const deg of rotationCandidates) {
      // Request camera rotation in degrees via debug helper; StarDisk applies
      // the rotation inside the render loop when debug hooks are present.
      await page.evaluate((d) => {
        try {
          (window as any).__copilot_rotateCameraDeltaDeg = d;
        } catch {}
      }, deg);
      // Allow a couple frames to render after rotation
      await page.waitForTimeout(250);
      // Probe for occluding dark pixel near star projection
      if (!starPos) break;
      const found = await probeForDarkPixel(starPos!.x!, starPos!.y!, 140, 6);
      if (found) {
        occluded = true;
        break;
      }
    }

    expect(occluded).toBe(true);
  });
});
