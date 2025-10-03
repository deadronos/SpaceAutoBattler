#!/usr/bin/env tsx
/* eslint-disable */
// Standalone script: intentionally disable ESLint type-aware checks because
// scripts/ are not included in the project's tsconfig.json. This file will
// still be type-checked by tsx when executed locally but linting in the
// repository CI is suppressed for clarity.
/**
 * Generate Playwright Baselines
 * 
 * Helper script to generate baseline screenshots for ship hull rendering tests.
 * Run this when:
 * - Adding new ship hulls
 * - Updating GLTF models
 * - Changing renderer settings that affect visuals
 * 
 * Usage:
 *   npm run generate-baselines
 *   npm run generate-baselines -- --hull fighter
 */

import { chromium } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const HULLS = [
  'fighter',
  'corvette', 
  'frigate',
  'destroyer',
  'carrier'
];

const BASE_URL = process.env.E2E_BASE || 'http://localhost:8080/';
const BASELINE_DIR = path.join(__dirname, '../test/playwright/baselines');
const VIEWPORT = { width: 1280, height: 800 };

// Parse CLI args
const args = process.argv.slice(2);
const hullArg = args.find(arg => arg.startsWith('--hull='));
const specificHull = hullArg ? hullArg.split('=')[1] : null;

const hullsToGenerate = specificHull ? [specificHull] : HULLS;
const GENERATE_STAR_OCCLUSION = args.includes('--star-occlusion');
const STAR_ROT_ARG = args.find((a) => a.startsWith('--star-rot='));
const STAR_ROT_DEG = STAR_ROT_ARG ? Number(STAR_ROT_ARG.split('=')[1]) : -15;

async function generateBaseline(browser: any, hullId: string) {
  const page = await browser.newPage({ viewport: VIEWPORT });
  
  try {
    console.log(`Generating baseline for ${hullId}...`);
    
    // Navigate to test page
    const params = new URLSearchParams({
      hull: hullId,
      frame: '0',
      shield: 'false',
      engine: 'false',
      postprocessing: 'false'
    });
    
    await page.goto(`${BASE_URL}test/playwright/pages/ship-renderer.html?${params.toString()}`);
    
    // Wait for ready
    const readyResult = await page.evaluate(async () => {
      return await (window as any).__TEST__.waitForReady();
    });
    
    if (readyResult.error) {
      throw new Error(`Failed to load ${hullId}: ${readyResult.error}`);
    }
    
    // Get scene summary for logging
    const summary = await page.evaluate(async () => {
      return await (window as any).__TEST__.getSceneSummary();
    });
    
    console.log(`  - Meshes: ${summary.meshCount}`);
    console.log(`  - Materials: ${summary.materials.length}`);
    
    // Capture canvas screenshot
    const canvas = page.locator('#canvas');
    const baselinePath = path.join(BASELINE_DIR, `${hullId}.png`);
    
    await canvas.screenshot({ path: baselinePath });
    
    console.log(`  ✓ Baseline saved: ${baselinePath}`);
    
    // Also save scene summary for reference
    const summaryPath = path.join(BASELINE_DIR, `${hullId}-summary.json`);
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    console.log(`  ✓ Summary saved: ${summaryPath}`);
    
  } catch (error: unknown) {
    console.error(`  ✗ Failed to generate baseline for ${hullId}:`, (error as Error)?.message ?? String(error));
    throw error;
  } finally {
    await page.close();
  }
}

async function generateStarBaseline(browser: any) {
  const page = await browser.newPage({ viewport: VIEWPORT });
   
  try {
    console.log(`Generating star occlusion baseline...`);
    
    // Ensure postprocessing mounts and request a deterministic rotation on load
    await page.addInitScript((rotDeg: number) => {
      try {
        (window as any).__copilot_forcePostprocessingMount = true;
        (window as any).__copilot_rotateCameraDeltaDeg = rotDeg;
      } catch { /* ignore */ }
    }, STAR_ROT_DEG);
    
    // Navigate to the main app in debug mode so the star overlay is present
    await page.goto(`${BASE_URL}spaceautobattler.html?copilot_debug=1`);
    
    // Wait for the star screen indicator overlay used by tests
    await page.waitForSelector('#copilot-star-screen-indicator', { timeout: 10000 });
    
    // Pause the simulation (click Pause UI if present)
    const pauseButton = page.getByRole('button', { name: 'Pause' });
    if (await pauseButton.isVisible()) {
      await pauseButton.click();
      await page.waitForTimeout(200);
    }
    
    // Capture canvas screenshot
    const canvas = page.locator('canvas');
    const baselinePath = path.join(BASELINE_DIR, `star-occlusion.png`);
    await canvas.screenshot({ path: baselinePath });
    console.log(`  ✓ Star occlusion baseline saved: ${baselinePath}`);
   
  } catch (error: unknown) {
    console.error(`  ✗ Failed to generate star occlusion baseline:`, (error as Error)?.message ?? String(error));
    throw error;
   } finally {
     await page.close();
   }
}

async function main() {
  console.log('Playwright Baseline Generator');
  console.log('==============================\n');
  
  // Ensure baseline directory exists
  if (!fs.existsSync(BASELINE_DIR)) {
    fs.mkdirSync(BASELINE_DIR, { recursive: true });
    console.log(`Created baseline directory: ${BASELINE_DIR}\n`);
  }
  
  // Validate hull IDs
  for (const hull of hullsToGenerate) {
    if (!HULLS.includes(hull)) {
      console.error(`Error: Unknown hull ID "${hull}"`);
      console.error(`Valid hulls: ${HULLS.join(', ')}`);
      process.exit(1);
    }
  }
  
  console.log(`Generating baselines for: ${hullsToGenerate.join(', ')}\n`);
  if (GENERATE_STAR_OCCLUSION) console.log('Star occlusion baseline: enabled via --star-occlusion');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Viewport: ${VIEWPORT.width}x${VIEWPORT.height}\n`);
  
  // Launch browser
  const browser = await chromium.launch({ 
    headless: true,
    args: [
      '--disable-gpu',
      '--use-gl=swiftshader' // Use software GL for consistency
    ]
  });
  
  try {
    // Generate hull baselines sequentially
    for (const hullId of hullsToGenerate) {
      await generateBaseline(browser, hullId);
    }
    
    // Optionally generate star occlusion baseline
    if (GENERATE_STAR_OCCLUSION) {
      await generateStarBaseline(browser);
    }
    
    console.log('\n✓ All baselines generated successfully!');
    console.log('\nNext steps:');
    console.log('1. Review the generated baseline images');
    console.log('2. Commit the baselines to version control');
    console.log('3. Run tests with: npm run test:playwright');
    
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
