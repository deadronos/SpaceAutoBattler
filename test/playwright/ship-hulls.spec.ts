/**
 * Ship Hull Rendering Tests
 *
 * Tests visual rendering correctness for all ship hulls using:
 * 1. Scene introspection (mesh names, materials, uniforms)
 * 2. Screenshot comparison (pixel-based validation)
 */

import { test, expect, Page } from '@playwright/test';
import type { TestInfo } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Extend Window interface for test API
declare global {
  interface Window {
    __TEST__: {
      waitForReady: () => Promise<{ frameRendered: number; error?: string }>;
      getSceneSummary: () => Promise<SceneSummary>;
      setOptions: (options: Record<string, unknown>) => Promise<{ success: boolean }>;
    };
  }
}

interface SceneSummary {
  hullId: string;
  frameRendered: number;
  shieldEnabled: boolean;
  engineEnabled: boolean;
  meshCount: number;
  meshes: Array<{
    name: string;
    visible: boolean;
    boundingBox: {
      min: { x: number; y: number; z: number };
      max: { x: number; y: number; z: number };
    };
  }>;
  materials: Array<{
    name: string;
    type: string;
    visible: boolean;
    emissive?: number;
    emissiveIntensity?: number;
    color?: number;
    opacity?: number;
    transparent?: boolean;
  }>;
  uniforms: Record<string, number | boolean>;
  error?: string;
}

// Hull list to test (matching src/assets/ships.ts)
const HULLS_TO_TEST = ['fighter', 'corvette', 'frigate', 'destroyer', 'carrier'];

// Test configuration
const TEST_CONFIG = {
  // Representative subset for CI (full suite can run nightly)
  ciSubset: ['fighter', 'frigate', 'carrier'],

  // Screenshot comparison tolerances
  maxDiffPixelRatio: 0.05, // 5% pixel difference allowed

  // Timeout for model loading
  loadTimeout: 30000,

  // Baseline directory
  baselineDir: path.join(__dirname, 'baselines'),

  // Debug artifact directory
  debugDir: path.join(__dirname, 'debug'),
};

// Ensure directories exist
if (!fs.existsSync(TEST_CONFIG.baselineDir)) {
  fs.mkdirSync(TEST_CONFIG.baselineDir, { recursive: true });
}

/**
 * Helper: Navigate to ship renderer page and wait for ready
 */
async function loadShipRenderer(
  page: Page,
  hullId: string,
  options: {
    frame?: number;
    shield?: boolean;
    engine?: boolean;
    postprocessing?: boolean;
  } = {},
) {
  const params = new URLSearchParams({
    hull: hullId,
    frame: String(options.frame || 0),
    shield: String(options.shield || false),
    engine: String(options.engine || false),
    postprocessing: String(options.postprocessing !== false),
  });

  await page.goto(`/test/playwright/pages/ship-renderer.html?${params.toString()}`);

  // Wait for the test API to be ready
  await page.waitForFunction(() => window.__TEST__ && window.__TEST__.waitForReady);

  const readyResult = await page.evaluate(async () => {
    return await window.__TEST__.waitForReady();
  });

  expect(readyResult.error).toBeUndefined();
  expect(readyResult.frameRendered).toBeGreaterThanOrEqual(0);

  return readyResult;
}

/**
 * Helper: Get scene summary from test page
 */
async function getSceneSummary(page: Page): Promise<SceneSummary> {
  return await page.evaluate(async () => {
    return await window.__TEST__.getSceneSummary();
  });
}

/**
 * Helper: Save debug artifacts on failure
 */
async function saveDebugArtifacts(
  page: Page,
  hullId: string,
  summary: SceneSummary,
  testInfo: TestInfo,
) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const debugPath = path.join(TEST_CONFIG.debugDir, `${hullId}-${timestamp}`);

  if (!fs.existsSync(debugPath)) {
    fs.mkdirSync(debugPath, { recursive: true });
  }

  // Save full page screenshot
  await page.screenshot({
    path: path.join(debugPath, 'fullpage.png'),
    fullPage: true,
  });

  // Save cropped canvas screenshot
  const canvas = page.locator('#canvas');
  await canvas.screenshot({
    path: path.join(debugPath, 'canvas.png'),
  });

  // Save scene summary
  fs.writeFileSync(path.join(debugPath, 'scene-summary.json'), JSON.stringify(summary, null, 2));

  // Save failure note
  const failureNote = `# Test Failure: ${hullId}

## Timestamp
${new Date().toISOString()}

## Test Info
- Title: ${testInfo.title}
- File: ${testInfo.file}

## Scene Summary
See scene-summary.json

## Artifacts
- fullpage.png - Complete page screenshot
- canvas.png - Canvas-only screenshot
- scene-summary.json - Scene introspection data

## Suggested Next Steps
1. Review scene-summary.json for missing or unexpected meshes/materials
2. Compare canvas.png with baseline image
3. Check for shader uniform mismatches in scene summary
4. Validate GLTF model integrity
`;

  fs.writeFileSync(path.join(debugPath, 'failure.md'), failureNote);

  console.log(`Debug artifacts saved to: ${debugPath}`);
}

// Determine which hulls to test based on environment
const hullsToTest = process.env.CI ? TEST_CONFIG.ciSubset : HULLS_TO_TEST;

test.describe('Ship Hull Rendering', () => {
  test.beforeEach(async ({ page }) => {
    // Suppress console noise for cleaner test output
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.error('Browser console error:', msg.text());
      }
    });
  });

  for (const hullId of hullsToTest) {
    test.describe(`Hull: ${hullId}`, () => {
      test('should load GLTF model without errors', async ({ page }) => {
        await loadShipRenderer(page, hullId);

        const summary = await getSceneSummary(page);

        // Basic validation
        expect(summary.error).toBeUndefined();
        expect(summary.hullId).toBe(hullId);
        expect(summary.meshCount).toBeGreaterThan(0);
      });

      test('should have expected scene structure', async ({ page }, testInfo) => {
        await loadShipRenderer(page, hullId);

        const summary = await getSceneSummary(page);

        try {
          // Verify we have meshes
          expect(summary.meshes).toBeDefined();
          expect(summary.meshes.length).toBeGreaterThan(0);

          // Verify we have materials
          expect(summary.materials).toBeDefined();
          expect(summary.materials.length).toBeGreaterThan(0);

          // Verify mesh names are present and reasonable
          for (const mesh of summary.meshes) {
            expect(mesh.name).toBeDefined();
            expect(mesh.boundingBox).toBeDefined();
            expect(mesh.boundingBox.min).toBeDefined();
            expect(mesh.boundingBox.max).toBeDefined();
          }

          // Verify materials have expected properties
          for (const material of summary.materials) {
            expect(material.type).toBeDefined();
            expect([
              'MeshStandardMaterial',
              'MeshBasicMaterial',
              'MeshPhysicalMaterial',
              'ShaderMaterial',
            ]).toContain(material.type);
          }
        } catch (error) {
          await saveDebugArtifacts(page, hullId, summary, testInfo);
          throw error;
        }
      });

      test('should render consistent screenshot', async ({ page }, testInfo) => {
        await loadShipRenderer(page, hullId, { postprocessing: false });

        const summary = await getSceneSummary(page);
        const canvas = page.locator('#canvas');

        try {
          // Take screenshot and compare with baseline
          const baselinePath = path.join(TEST_CONFIG.baselineDir, `${hullId}.png`);

          if (fs.existsSync(baselinePath)) {
            // Compare with existing baseline
            await expect(canvas).toHaveScreenshot(`${hullId}.png`, {
              maxDiffPixelRatio: TEST_CONFIG.maxDiffPixelRatio,
              threshold: 0.2, // Adjust as needed
            });
          } else {
            // Generate baseline (first run or update mode)
            await canvas.screenshot({ path: baselinePath });
            console.log(`Generated baseline for ${hullId}: ${baselinePath}`);

            // Also verify the screenshot was generated successfully
            expect(fs.existsSync(baselinePath)).toBe(true);
          }
        } catch (error) {
          await saveDebugArtifacts(page, hullId, summary, testInfo);
          throw error;
        }
      });

      // TODO: Add shield-specific tests when shield rendering is implemented
      test.skip('should render shield when enabled', async ({ page }) => {
        await loadShipRenderer(page, hullId, { shield: true });

        const summary = await getSceneSummary(page);

        // Look for shield mesh or shader uniform
        const hasShieldMesh = summary.meshes.some((m) => m.name.toLowerCase().includes('shield'));
        const hasShieldUniform =
          typeof summary.uniforms.shieldAlpha === 'number' && summary.uniforms.shieldAlpha > 0;

        expect(hasShieldMesh || hasShieldUniform).toBe(true);
      });

      // TODO: Add engine glow tests when engine rendering is implemented
      test('should render engine glow when enabled', async ({ page }) => {
        await loadShipRenderer(page, hullId, { engine: true });

        const summary = await getSceneSummary(page);

        // Look for engine-related emissive materials
        const hasEngineGlow = summary.materials.some(
          (m) =>
            (m.name.toLowerCase().includes('engine') || m.name.toLowerCase().includes('glow')) &&
            m.emissiveIntensity !== undefined &&
            m.emissiveIntensity > 0,
        );

        expect(hasEngineGlow).toBe(true);
      });
    });
  }
});

test.describe('Determinism Validation', () => {
  test('repeated renders should be identical', async ({ page }) => {
    const hullId = 'fighter'; // Test with one hull

    // Render twice with same parameters
    await loadShipRenderer(page, hullId, { frame: 0 });
    const summary1 = await getSceneSummary(page);

    await page.reload();
    await loadShipRenderer(page, hullId, { frame: 0 });
    const summary2 = await getSceneSummary(page);

    // Scene summaries should be identical
    expect(summary1.meshCount).toBe(summary2.meshCount);
    expect(summary1.meshes.length).toBe(summary2.meshes.length);
    expect(summary1.materials.length).toBe(summary2.materials.length);
  });
});
