import { describe, it, expect, beforeEach } from 'vitest';
import { createMockGameState } from './setupTests.js';
import { GameState, Ship } from '../../src/types/index.js';
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

    let bulletsCreated = false;
    
    // Simulate for a few steps
    for (let i = 0; i < 20; i++) {
      state.time += 0.1;
      state.tick++;
      simulateStep(state, 0.1);
      
      if (state.bullets.length > 0) {
        bulletsCreated = true;
      }
      
      log.push(`Step ${i + 1}:`);
      log.push(`  Red: pos=(${redShip.pos.x.toFixed(1)}, ${redShip.pos.y.toFixed(1)}), target=${redShip.targetId}, intent=${redShip.aiState?.currentIntent}, health=${redShip.health}`);
      log.push(`  Blue: pos=(${blueShip.pos.x.toFixed(1)}, ${blueShip.pos.y.toFixed(1)}), target=${blueShip.targetId}, intent=${blueShip.aiState?.currentIntent}, health=${blueShip.health}`);
      log.push(`  Distance: ${Math.hypot(redShip.pos.x - blueShip.pos.x, redShip.pos.y - blueShip.pos.y, redShip.pos.z - blueShip.pos.z).toFixed(1)}, Bullets: ${state.bullets.length}`);
    }

    // Show debug output when test fails
    if (!bulletsCreated) {
      console.log('\nDEBUG: No bullets were created during simulation!');
      console.log(log.join('\n'));
    }

    // Both ships should have targets
    expect(redShip.targetId, `Red ship should have a target`).toBeTruthy();
    expect(blueShip.targetId, `Blue ship should have a target`).toBeTruthy();
    
    // Ships should be moving towards each other
    const initialDistance = 200;
    const finalDistance = Math.hypot(redShip.pos.x - blueShip.pos.x, redShip.pos.y - blueShip.pos.y, redShip.pos.z - blueShip.pos.z);
    expect(finalDistance, `Ships should move closer: initial=${initialDistance}, final=${finalDistance.toFixed(1)}`).toBeLessThan(initialDistance);
    
    // At least some bullets should be created during engagement
    expect(bulletsCreated, `Ships should fire bullets during engagement`).toBe(true);
  });
});