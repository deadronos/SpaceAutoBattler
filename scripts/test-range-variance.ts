/**
 * Manual test script to demonstrate range variance implementation
 * Run with: npx tsx scripts/test-range-variance.ts
 */

import { AI_CONFIG } from '../src/game/config.js';
import { SHIP_STATS } from '../src/game/ships.js';
import {
  adjustProjectileSpeedForHullAndBullet,
  applyRangeVariance,
} from '../src/game/utils/rangePolicy.js';
import type { ShipHull } from '../src/types/index.js';

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
for (const hull of hulls) {
  const baseSpeed = SHIP_STATS[hull].projectileSpeed;
  const bulletType = SHIP_STATS[hull].bulletType;
  const adjustedSpeed = adjustProjectileSpeedForHullAndBullet(
    hull,
    baseSpeed,
    bulletType,
    false,
    AI_CONFIG,
  );
  const finalSpeed = Math.round(adjustedSpeed);

  console.log(
    `${hull.padEnd(10)} | Base: ${baseSpeed.toString().padStart(2)} | Adjusted: ${finalSpeed
      .toString()
      .padStart(2)} | ${bulletType}`,
  );
}

console.log('\n✅ Range compression mitigation implemented!');
console.log('- Range variance: ±5% per weapon using deterministic seeding');
console.log('- Speed variance: Hull and weapon type adjustments');
console.log('- All changes gated behind rangePolicy flag');
