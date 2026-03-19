#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

// Configuration
const PLAYWRIGHT_DEBUG_DIR = path.resolve(__dirname, '../playwright-debug');
const VIEWPORT = { width: 1280, height: 720 };
const STAR_CENTER_X = VIEWPORT.width / 2;
const STAR_CENTER_Y = VIEWPORT.height / 2;

// Calculate luminance from RGB values (ITU-R BT.709 standard)
function calculateLuminance(r, g, b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Extract pixels at given radius and return metrics
function analyzePixelsAtRadius(pngData, centerX, centerY, radius, sampleCount = 32) {
  const luminanceValues = [];

  for (let i = 0; i < sampleCount; i++) {
    const angle = (i / sampleCount) * 2 * Math.PI;
    const x = Math.round(centerX + Math.cos(angle) * radius);
    const y = Math.round(centerY + Math.sin(angle) * radius);

    // Ensure coordinates are within bounds
    if (x >= 0 && x < pngData.width && y >= 0 && y < pngData.height) {
      const idx = (pngData.width * y + x) << 2; // RGBA format
      const r = pngData.data[idx] / 255;
      const g = pngData.data[idx + 1] / 255;
      const b = pngData.data[idx + 2] / 255;
      const luminance = calculateLuminance(r, g, b);
      luminanceValues.push(luminance);
    }
  }

  const meanLuminance = luminanceValues.reduce((sum, val) => sum + val, 0) / luminanceValues.length;
  const variance =
    luminanceValues.reduce((sum, val) => sum + Math.pow(val - meanLuminance, 2), 0) /
    luminanceValues.length;

  return { luminanceValues, meanLuminance, variance };
}

function analyzeImage(filePath, label) {
  console.log(`\n=== Analyzing ${label} ===`);

  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filePath}`);
    return null;
  }

  const pngBuffer = fs.readFileSync(filePath);
  const pngData = PNG.sync.read(pngBuffer);

  console.log(`Image dimensions: ${pngData.width}x${pngData.height}`);

  // Estimate star disk radius based on viewport size
  const estimatedStarRadius = Math.min(VIEWPORT.width, VIEWPORT.height) * 0.15; // Roughly 15% of viewport
  console.log(`Estimated star radius: ${estimatedStarRadius.toFixed(1)}px`);

  // 1. Centre-to-mid radius luminance ratio ≥ 3.3×
  const centerRadius = estimatedStarRadius * 0.1; // Core center
  const midRadius = estimatedStarRadius * 0.6; // Mid-radius for comparison

  const centerMetrics = analyzePixelsAtRadius(
    pngData,
    STAR_CENTER_X,
    STAR_CENTER_Y,
    centerRadius,
    8,
  );
  const midMetrics = analyzePixelsAtRadius(pngData, STAR_CENTER_X, STAR_CENTER_Y, midRadius, 32);

  const luminanceRatio = centerMetrics.meanLuminance / Math.max(midMetrics.meanLuminance, 0.001);

  console.log(`Center luminance: ${centerMetrics.meanLuminance.toFixed(4)}`);
  console.log(`Mid-radius luminance: ${midMetrics.meanLuminance.toFixed(4)}`);
  console.log(
    `Luminance ratio: ${luminanceRatio.toFixed(2)}× ${luminanceRatio >= 3.3 ? '✓' : '✗'} (target: ≥3.3×)`,
  );

  // 2. Filament variance σ ≥ 0.08 at radius 0.45
  const filamentRadius = estimatedStarRadius * 0.45;
  const filamentMetrics = analyzePixelsAtRadius(
    pngData,
    STAR_CENTER_X,
    STAR_CENTER_Y,
    filamentRadius,
    32,
  );
  const standardDeviation = Math.sqrt(filamentMetrics.variance);

  console.log(
    `Filament variance at r=0.45: σ = ${standardDeviation.toFixed(4)} ${standardDeviation >= 0.08 ? '✓' : '✗'} (target: ≥0.08)`,
  );

  // 3. Halo brightness at 1.15× radius ≤ 35% of core while ≥ 10% visible
  const haloRadius = estimatedStarRadius * 1.15;
  const haloMetrics = analyzePixelsAtRadius(pngData, STAR_CENTER_X, STAR_CENTER_Y, haloRadius, 32);

  const haloBrightnessRatio =
    haloMetrics.meanLuminance / Math.max(centerMetrics.meanLuminance, 0.001);

  console.log(`Halo luminance: ${haloMetrics.meanLuminance.toFixed(4)}`);
  console.log(`Halo brightness ratio: ${(haloBrightnessRatio * 100).toFixed(1)}% of core`);

  const halo35Check = haloBrightnessRatio <= 0.35;
  const halo10Check = haloBrightnessRatio >= 0.1;
  console.log(`Halo ≤ 35% of core: ${halo35Check ? '✓' : '✗'}`);
  console.log(`Halo ≥ 10% visible: ${halo10Check ? '✓' : '✗'}`);

  return {
    luminanceRatio,
    filamentVariance: standardDeviation,
    haloBrightnessRatio,
    passesLuminanceTest: luminanceRatio >= 3.3,
    passesFilamentTest: standardDeviation >= 0.08,
    passesHaloUpperTest: halo35Check,
    passesHaloLowerTest: halo10Check,
    passesAllTests:
      luminanceRatio >= 3.3 && standardDeviation >= 0.08 && halo35Check && halo10Check,
  };
}

// Main analysis
console.log('Star Disk Visual Analysis');
console.log('========================');

const beforePath = path.join(PLAYWRIGHT_DEBUG_DIR, 'star-disk-before.png');
const afterPath = path.join(PLAYWRIGHT_DEBUG_DIR, 'star-disk-after.png');

const beforeResults = analyzeImage(beforePath, 'BEFORE (Legacy)');
const afterResults = analyzeImage(afterPath, 'AFTER (Fiery Enhanced)');

if (beforeResults && afterResults) {
  console.log('\n=== COMPARISON SUMMARY ===');
  console.log(
    `Luminance ratio: ${beforeResults.luminanceRatio.toFixed(2)}× → ${afterResults.luminanceRatio.toFixed(2)}× (${afterResults.luminanceRatio > beforeResults.luminanceRatio ? '↑' : '↓'})`,
  );
  console.log(
    `Filament variance: ${beforeResults.filamentVariance.toFixed(4)} → ${afterResults.filamentVariance.toFixed(4)} (${afterResults.filamentVariance > beforeResults.filamentVariance ? '↑' : '↓'})`,
  );
  console.log(
    `Halo brightness: ${(beforeResults.haloBrightnessRatio * 100).toFixed(1)}% → ${(afterResults.haloBrightnessRatio * 100).toFixed(1)}% (${afterResults.haloBrightnessRatio < beforeResults.haloBrightnessRatio ? '↓' : '↑'})`,
  );

  console.log('\n=== ACCEPTANCE CRITERIA ===');
  console.log(`✓ Enhanced luminance ratio: ${afterResults.passesLuminanceTest ? 'PASS' : 'FAIL'}`);
  console.log(`✓ Enhanced filament variance: ${afterResults.passesFilamentTest ? 'PASS' : 'FAIL'}`);
  console.log(
    `✓ Controlled halo brightness: ${afterResults.passesHaloUpperTest && afterResults.passesHaloLowerTest ? 'PASS' : 'FAIL'}`,
  );

  console.log(
    `\n🎯 OVERALL RESULT: ${afterResults.passesAllTests ? '✅ ALL TESTS PASS' : '❌ SOME TESTS FAILED'}`,
  );

  if (afterResults.passesAllTests) {
    console.log('\nThe fiery star disk enhancement successfully meets all acceptance criteria!');
  } else {
    console.log('\nSome acceptance criteria are not met. Further parameter tuning may be needed.');
  }
} else {
  console.log(
    '\n❌ Could not analyze images. Please ensure star-disk-before.png and star-disk-after.png exist in playwright-debug/',
  );
}
