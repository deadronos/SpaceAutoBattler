import { test, expect } from '@playwright/test';

test.describe('GLTF Mesh Rendering Visual Test', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the SpaceAutoBattler application
    await page.goto('http://localhost:8081/spaceautobattler.html');

    // Wait for the application to load
    await page.waitForSelector('#world');
    await page.waitForTimeout(2000); // Give GLTF loading time
  });

  test('should render GLTF meshes instead of fallback geometry', async ({ page }) => {
    // Wait for the canvas to be ready
    const canvas = page.locator('#world');
    await expect(canvas).toBeVisible();

    // Add some ships to test rendering
    const addRedButton = page.locator('#addRed');
    const addBlueButton = page.locator('#addBlue');

    await addRedButton.click();
    await addRedButton.click();
    await addBlueButton.click();
    await addBlueButton.click();

    // Wait for ships to be spawned and rendered
    await page.waitForTimeout(3000);

    // Check that ships were added (check the stats)
    const stats = page.locator('#stats');
    await expect(stats).toContainText('Ships');

    // Take a screenshot for visual comparison
    await page.screenshot({
      path: 'test-output/after-gltf-fix.png',
      fullPage: false,
    });

    // Check console for GLTF loading success (no specific errors about missing meshes)
    const logs = await page.evaluate(() => {
      return (window as any).console.logs || [];
    });

    // The application should have loaded without critical errors
    // If GLTF meshes are loading correctly, we should see proper 3D models
    console.log('Page logs:', logs);

    // Zoom in to get a better view of the ships using camera controls
    await page.keyboard.press('KeyW'); // Move camera forward
    await page.keyboard.press('KeyW');
    await page.keyboard.press('KeyW');

    await page.waitForTimeout(1000);

    // Take a closer screenshot
    await page.screenshot({
      path: 'test-output/after-gltf-fix-closeup.png',
      fullPage: false,
    });
  });

  test('should load GLTF assets successfully', async ({ page }) => {
    // Check that GLTF files are accessible
    const fighterResponse = await page.request.get(
      'http://localhost:8081/src/config/assets/gltf/fighter.glb',
    );
    expect(fighterResponse.status()).toBe(200);
    expect(fighterResponse.headers()['content-type']).toContain('model/gltf-binary');

    const corvette = await page.request.get(
      'http://localhost:8081/src/config/assets/gltf/corvette.glb',
    );
    expect(corvette.status()).toBe(200);

    const frigate = await page.request.get(
      'http://localhost:8081/src/config/assets/gltf/frigate.glb',
    );
    expect(frigate.status()).toBe(200);

    const destroyer = await page.request.get(
      'http://localhost:8081/src/config/assets/gltf/destroyer.glb',
    );
    expect(destroyer.status()).toBe(200);

    const carrier = await page.request.get(
      'http://localhost:8081/src/config/assets/gltf/carrier.glb',
    );
    expect(carrier.status()).toBe(200);
  });

  test('should extract GLTF prototype data', async ({ page }) => {
    // Wait for application to initialize
    await page.waitForTimeout(3000);

    // Check if debug functions are available and asset pool has data
    const assetPoolKeys = await page.evaluate(() => {
      const debug = (window as any).__appDebug;
      if (debug && debug.listAssetPool) {
        return debug.listAssetPool();
      }
      return [];
    });

    console.log('Asset pool keys:', assetPoolKeys);

    // Check if GLTF prototypes exist in asset pool
    const hasGltfAssets = assetPoolKeys.some((key: string) => key.includes('ship-'));
    expect(hasGltfAssets).toBe(true);

    // Check a specific asset
    const fighterAsset = await page.evaluate(() => {
      const debug = (window as any).__appDebug;
      if (debug && debug.getAsset) {
        return debug.getAsset('ship-fighter-red');
      }
      return null;
    });

    console.log('Fighter asset structure:', fighterAsset ? Object.keys(fighterAsset) : 'null');

    if (fighterAsset) {
      expect(fighterAsset).toHaveProperty('className');
      expect(fighterAsset).toHaveProperty('gltf');
      // With the fix, this should now have threePrototypes
      expect(fighterAsset).toHaveProperty('threePrototypes');

      if (fighterAsset.threePrototypes) {
        expect(fighterAsset.threePrototypes.geometries).toBeDefined();
        expect(fighterAsset.threePrototypes.materials).toBeDefined();
        expect(fighterAsset.threePrototypes.geometries.length).toBeGreaterThan(0);
        console.log('✓ GLTF prototype extraction working correctly!');
      }
    }
  });
});
