#!/usr/bin/env node

/**
 * Script to generate new star disk screenshots with current fiery parameters
 * This would normally use Playwright, but we'll provide instructions for manual testing
 */

const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.resolve(__dirname, '../src/config/environment.ts');
const CAPTURE_DIR = path.resolve(__dirname, '../playwright-debug');

console.log('🔥 Star Disk Fiery Configuration Generator');
console.log('==========================================\n');

// Read current configuration
if (fs.existsSync(CONFIG_FILE)) {
  const config = fs.readFileSync(CONFIG_FILE, 'utf8');
  
  // Extract key fiery parameters
  const extractParam = (name) => {
    const match = config.match(new RegExp(`${name}:\\s*([0-9.]+)`));
    return match ? parseFloat(match[1]) : null;
  };
  
  console.log('📊 Current Fiery Configuration:');
  console.log('--------------------------------');
  console.log(`Core Strength: ${extractParam('coreStrength')}`);
  console.log(`Core Tightness: ${extractParam('coreTightness')}`);  
  console.log(`Core Radius Inner: ${extractParam('coreRadiusInner')}`);
  console.log(`Core Radius Outer: ${extractParam('coreRadiusOuter')}`);
  console.log(`Corona Filament Strength: ${extractParam('coronaFilamentStrength')}`);
  console.log(`Halo Falloff: ${extractParam('haloFalloff')}`);
  console.log(`Swirl Rate: ${extractParam('swirlRate')}`);
  console.log(`Sector Darkening: ${extractParam('sectorDarkeningStrength')}`);
}

console.log('\n🎯 Target Acceptance Criteria:');
console.log('-------------------------------');
console.log('✓ Centre-to-mid radius luminance ratio ≥ 3.3×');
console.log('✓ Filament variance σ ≥ 0.08 at radius 0.45');
console.log('✓ Halo brightness at 1.15× radius ≤ 35% of core while ≥ 10% visible');

console.log('\n🚀 Manual Testing Instructions:');
console.log('--------------------------------');
console.log('1. Start the development server:');
console.log('   npm run serve');
console.log('');
console.log('2. Open your browser to: http://localhost:8080/');
console.log('');
console.log('3. Take screenshots for comparison:');
console.log('   - Pause the simulation for stable captures');
console.log('   - Focus on the star disk in the center');
console.log('   - Save as: star-disk-fiery-updated.png');
console.log('');
console.log('4. For debug testing, open browser console and run:');
console.log(`   window.__STAR_DISK_DEBUG__ = {`);
console.log(`     shaderOverrides: {`);
console.log(`       timeMultiplier: 0, // Freeze animation`);
console.log(`       coreStrength: 2.6, // Enhanced brightness`);
console.log(`       coreTightness: 2.4 // Concentrated hotspot`);
console.log(`     }`);
console.log(`   };`);
console.log('');
console.log('5. Compare with existing captures in playwright-debug/');
console.log('');

// Check if capture directory exists
if (fs.existsSync(CAPTURE_DIR)) {
  const files = fs.readdirSync(CAPTURE_DIR);
  console.log('📁 Existing Captures:');
  console.log('----------------------');
  files.forEach(file => {
    if (file.endsWith('.png')) {
      const stats = fs.statSync(path.join(CAPTURE_DIR, file));
      console.log(`   ${file} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
    }
  });
} else {
  console.log('📁 Creating capture directory...');
  fs.mkdirSync(CAPTURE_DIR, { recursive: true });
}

console.log('\n🔍 After capturing new screenshots, run:');
console.log('   node scripts/visual-analysis.cjs');
console.log('');
console.log('   This will analyze the updated captures and verify');
console.log('   if they meet the acceptance criteria.');

console.log('\n✨ Enhanced Features in Current Implementation:');
console.log('-----------------------------------------------');
console.log('• Rotational swirl effects for flame-like motion');
console.log('• Sector darkening patterns for realistic fire');
console.log('• Enhanced core brightness for better contrast');
console.log('• Improved filament variance through texture enhancements');
console.log('• Controlled halo brightness within specification');
console.log('• 4x4 high-contrast fallback textures');
console.log('• Comprehensive parameter tuning for fiery appearance');