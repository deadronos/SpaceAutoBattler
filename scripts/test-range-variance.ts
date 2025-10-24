/**
 * Manual test script to demonstrate range variance implementation
 * Run with: npx tsx scripts/test-range-variance.ts
 */

import { AI_CONFIG } from '../src/game/config.js';
import { SHIP_STATS } from '../src/game/ships.js';
import { SeededRng } from '../src/utils/rng.js';
import type { ShipHull } from '../src/types/index.js';

// Replicate the range variance logic
function applyRangeVariance(baseRange: number, traitSeed: number, weaponIndex = 0): number {
  if (AI_CONFIG.rangePolicy !== 'v0.1.1-exp') return baseRange;

  const rangeSeed = Math.abs((traitSeed ^ (weaponIndex * 7919)) >>> 0) || 1;
  const rng = new SeededRng(rangeSeed);

  const variance = 0.05;
  const modifier = 1 + (rng.next() * 2 - 1) * variance;

  return Math.round(baseRange * modifier);
}

function calculateRangeStats(ranges: number[]): {
  min: number;
  max: number;
  mean: number;
  iqr: number;
} {
  const sorted = [...ranges].sort((a, b) => a - b);
  const q1Index = Math.floor(sorted.length * 0.25);
  const q3Index = Math.floor(sorted.length * 0.75);

  return {
    min: Math.min(...ranges),
    max: Math.max(...ranges),
    mean: ranges.reduce((sum, r) => sum + r, 0) / ranges.length,
    iqr: sorted[q3Index] - sorted[q1Index],
  };
}

console.log('🎯 Range Compression Analysis');
console.log('============================\n');

console.log(`Range Policy: ${AI_CONFIG.rangePolicy}`);
console.log('Analyzing weapon range distribution with ±5% variance\n');

const hulls: ShipHull[] = ['fighter', 'corvette', 'frigate', 'destroyer', 'carrier'];
const sampleSize = 20;

for (const hull of hulls) {
  console.log(`📊 ${hull.toUpperCase()}`);
  console.log('─'.repeat(30));

  const baseStats = SHIP_STATS[hull];
  const mainWeaponRanges: number[] = [];
  const turretRanges: number[] = [];

  // Generate sample ranges for main weapons
  for (let i = 0; i < sampleSize; i++) {
    const traitSeed = Math.floor(Math.random() * 1000000) + 1;
    const variedRange = applyRangeVariance(baseStats.range, traitSeed, 0);
    mainWeaponRanges.push(variedRange);

    // Generate turret ranges if ship has turrets
    baseStats.turrets?.forEach((turret, idx) => {
      const turretRange = applyRangeVariance(turret.range, traitSeed, idx + 1);
      turretRanges.push(turretRange);
    });
  }

  // Main weapon statistics
  const mainStats = calculateRangeStats(mainWeaponRanges);
  console.log(`Main Weapon (base: ${baseStats.range}):`);
  console.log(`  Range: ${mainStats.min} - ${mainStats.max} (IQR: ${mainStats.iqr})`);
  console.log(`  Mean: ${mainStats.mean.toFixed(1)}`);

  // Turret statistics
  if (turretRanges.length > 0) {
    const turretStats = calculateRangeStats(turretRanges);
    console.log(`Turrets (${baseStats.turrets?.length || 0} per ship):`);
    console.log(`  Range: ${turretStats.min} - ${turretStats.max} (IQR: ${turretStats.iqr})`);
    console.log(`  Mean: ${turretStats.mean.toFixed(1)}`);
  }

  console.log('');
}

console.log('🚀 Projectile Speed Variance');
console.log('=============================\n');

// Demonstrate projectile speed adjustments
const speedAdjustments = {
  fighter: 1.02,
  corvette: 0.98,
  frigate: 0.96,
  destroyer: 1.05,
  carrier: 1.05,
};

for (const hull of hulls) {
  const baseSpeed = SHIP_STATS[hull].projectileSpeed;
  const adjustment = speedAdjustments[hull];
  const newSpeed = Math.round(baseSpeed * adjustment);
  const bulletType = SHIP_STATS[hull].bulletType;

  let typeAdjustment = 1.0;
  if (bulletType.includes('laser')) typeAdjustment *= 0.97;
  if (bulletType.includes('heavy') || bulletType.includes('ion')) typeAdjustment *= 1.03;

  const finalSpeed = Math.round(newSpeed * typeAdjustment);

  console.log(
    `${hull.padEnd(10)} | Base: ${baseSpeed.toString().padStart(2)} | Hull: ${newSpeed.toString().padStart(2)} | Type: ${finalSpeed.toString().padStart(2)} | ${bulletType}`,
  );
}

console.log('\n✅ Range compression mitigation implemented!');
console.log('- Range variance: ±5% per weapon using deterministic seeding');
console.log('- Speed variance: Hull and weapon type adjustments');
console.log('- All changes gated behind rangePolicy flag');
