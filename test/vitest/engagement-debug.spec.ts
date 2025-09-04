import { describe, it, expect, beforeEach } from 'vitest';
import { createMockGameState } from './setupTests.js';
import { GameState } from '../../src/types/index.js';
import { spawnShip, simulateStep } from '../../src/core/gameState.js';
import { DEFAULT_BEHAVIOR_CONFIG } from '../../src/config/behaviorConfig.js';

describe('Engagement Debug Test', () => {
  let state: GameState;

  beforeEach(() => {
    state = createMockGameState();
    // Initialize behavior config
    state.behaviorConfig = JSON.parse(JSON.stringify(DEFAULT_BEHAVIOR_CONFIG));
    // Enable AI
    state.behaviorConfig.globalSettings.aiEnabled = true;
  });

  it('should debug why ships are not engaging', () => {
    // Spawn two opposing ships close to each other
    const redShip = spawnShip(state, 'red', 'fighter', { x: 200, y: 200, z: 200 });
    const blueShip = spawnShip(state, 'blue', 'fighter', { x: 400, y: 200, z: 200 }); // 200 units apart

    const log: string[] = [];
    log.push('Initial state:');
    log.push(`Red ship (${redShip.id}): pos=${JSON.stringify(redShip.pos)}, targetId=${redShip.targetId}`);
    log.push(`Blue ship (${blueShip.id}): pos=${JSON.stringify(blueShip.pos)}, targetId=${blueShip.targetId}`);

    // Instead of relying on transient presence of bullets in state.bullets
    // (they may be created and consumed during a single simulateStep),
    // detect engagement by checking whether either ship received damage or
    // has a recorded lastDamageTime. This is a stronger signal that firing
    // and collisions occurred during the simulation.
    let damageOccurred = false;

    // Simulate for a few steps
    let minDistance = Infinity;
    for (let i = 0; i < 20; i++) {
      state.time += 0.1;
      state.tick++;
      simulateStep(state, 0.1);
      // Detect transient damage recorded on ships (AI recentDamage or lastDamageTime)
      if ((redShip.aiState?.recentDamage && redShip.aiState.recentDamage > 0) ||
          (blueShip.aiState?.recentDamage && blueShip.aiState.recentDamage > 0) ||
          (typeof redShip.lastDamageTime === 'number' && redShip.lastDamageTime > 0) ||
          (typeof blueShip.lastDamageTime === 'number' && blueShip.lastDamageTime > 0)) {
        damageOccurred = true;
      }

      const dist = Math.hypot(redShip.pos.x - blueShip.pos.x, redShip.pos.y - blueShip.pos.y, redShip.pos.z - blueShip.pos.z);
      if (dist < minDistance) minDistance = dist;

      log.push(`Step ${i + 1}:`);
      log.push(`  Red: pos=(${redShip.pos.x.toFixed(1)}, ${redShip.pos.y.toFixed(1)}), target=${redShip.targetId}, intent=${redShip.aiState?.currentIntent}, health=${redShip.health}`);
      log.push(`  Blue: pos=(${blueShip.pos.x.toFixed(1)}, ${blueShip.pos.y.toFixed(1)}), target=${blueShip.targetId}, intent=${blueShip.aiState?.currentIntent}, health=${blueShip.health}`);
      log.push(`  Distance: ${dist.toFixed(1)}, Bullets: ${state.bullets.length}`);
    }

    // Show debug output when test fails
    if (!damageOccurred) {
      console.log('\nDEBUG: No damage was recorded during simulation (no hits)!');
      console.log(log.join('\n'));
    }

    // Both ships should have targets
    expect(redShip.targetId, `Red ship should have a target`).toBeTruthy();
    expect(blueShip.targetId, `Blue ship should have a target`).toBeTruthy();
    
  // Ships should be moving towards each other at some point during the sim
  const initialDistance = 200;
  expect(minDistance, `Ships should get closer than initial distance at some step: initial=${initialDistance}, min=${minDistance.toFixed(1)}`).toBeLessThan(initialDistance);
    
  // At least some damage should have been recorded during engagement
  expect(damageOccurred, `Ships should fire and cause damage during engagement`).toBe(true);
  });
});