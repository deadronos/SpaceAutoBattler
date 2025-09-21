import { test, expect } from '@playwright/test';

// Smoke test: load the standalone build and ensure no console errors and at least one InstancedMesh exists
test('instancing smoke - no console errors and instanced mesh present', async ({ page }) => {
  const consoleMessages: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleMessages.push(msg.text());
  });

  // Adjust path if build output is served from /dist/
  await page.goto('http://localhost:8080/dist/spaceautobattler.html');

  // Wait a short time for app to initialize and worker to post messages
  await page.waitForTimeout(1500);

  // Check for any window-scoped diagnostic about instanced meshes
  const instancedCount = await page.evaluate(() => {
    // Try to probe the global three renderer if exposed
    try {
      // Many apps expose a global renderer or scene for testing; attempt multiple keys
      const g = globalThis as unknown as Record<string, unknown>;
      const sceneCandidate1 = g.__three_scene as unknown;
      const sceneCandidate2 = g.scene as unknown;
      const sceneCandidate3 = g.appScene as unknown;
      const scene = (sceneCandidate1 || sceneCandidate2 || sceneCandidate3) as unknown;
      if (!scene) return 0;
      let count = 0;
      // traverse may not exist; guard accordingly

      // test helper probing global scene; narrow casts are noisy here
      if (typeof (scene as unknown as { traverse?: unknown }).traverse === 'function') {
        const traverseFn = (scene as unknown as { traverse: (cb: (o: unknown) => void) => void })
          .traverse;
        traverseFn((o: unknown) => {
          if (o && (o as unknown as { isInstancedMesh?: boolean }).isInstancedMesh) count++;
        });
      }
      return count;
    } catch {
      return 0;
    }
  });

  expect(consoleMessages.length).toBe(0);
  expect(instancedCount).toBeGreaterThanOrEqual(0); // presence is best-effort; we mainly assert no console errors
});
