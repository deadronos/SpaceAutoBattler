#!/usr/bin/env tsx
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

async function generateBaseline(browser, hullId) {
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
      return await window.__TEST__.waitForReady();
    });
    
    if (readyResult.error) {
      throw new Error(`Failed to load ${hullId}: ${readyResult.error}`);
    }
    
    // Get scene summary for logging
    const summary = await page.evaluate(async () => {
      return await window.__TEST__.getSceneSummary();
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
    
  } catch (error) {
    console.error(`  ✗ Failed to generate baseline for ${hullId}:`, error.message);
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
    // Generate baselines sequentially
    for (const hullId of hullsToGenerate) {
      await generateBaseline(browser, hullId);
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
