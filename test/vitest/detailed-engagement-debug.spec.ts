import { describe, it, expect, beforeEach } from 'vitest';
import { createMockGameState } from './setupTests.js';
import { GameState, Ship } from '../../src/types/index.js';
import { spawnShip, simulateStep } from '../../src/core/gameState.js';
import { DEFAULT_BEHAVIOR_CONFIG } from '../../src/config/behaviorConfig.js';
import { AIController } from '../../src/core/aiController.js';

describe('Detailed Engagement Debug', () => {
  let state: GameState;

  beforeEach(() => {
    state = createMockGameState();
    state.behaviorConfig = JSON.parse(JSON.stringify(DEFAULT_BEHAVIOR_CONFIG));
    state.behaviorConfig.globalSettings.aiEnabled = true;
  });

  it('should step through the targeting and engagement process in detail', () => {
    // Spawn two ships very close to each other to ensure they're in range
    const redShip = spawnShip(state, 'red', 'fighter', { x: 200, y: 200, z: 200 });
    const blueShip = spawnShip(state, 'blue', 'fighter', { x: 300, y: 200, z: 200 }); // Only 100 units apart

    const debugLog: string[] = [];
    debugLog.push('=== INITIAL STATE ===');
    debugLog.push(`Red ship (${redShip.id}): pos=${JSON.stringify(redShip.pos)}, targetId=${redShip.targetId}, aiState=${JSON.stringify(redShip.aiState)}`);
    debugLog.push(`Blue ship (${blueShip.id}): pos=${JSON.stringify(blueShip.pos)}, targetId=${blueShip.targetId}, aiState=${JSON.stringify(blueShip.aiState)}`);

    // Create an AI controller to test directly
    const aiController = new AIController(state);

    // Test one step of AI update before simulation
    debugLog.push('\n=== AFTER AI UPDATE (step 1) ===');
    aiController.updateAllShips(0.1);
    debugLog.push(`Red ship: pos=(${redShip.pos.x.toFixed(1)}, ${redShip.pos.y.toFixed(1)}), target=${redShip.targetId}, intent=${redShip.aiState?.currentIntent}`);
    debugLog.push(`Blue ship: pos=(${blueShip.pos.x.toFixed(1)}, ${blueShip.pos.y.toFixed(1)}), target=${blueShip.targetId}, intent=${blueShip.aiState?.currentIntent}`);

    let bulletsCreated = false;
    // Now run simulation which includes firing
    for (let i = 0; i < 5; i++) {
      state.time += 0.1;
      state.tick++;
      simulateStep(state, 0.1);
      
      debugLog.push(`\n--- Step ${i + 1} ---`);
      debugLog.push(`Red: pos=(${redShip.pos.x.toFixed(1)}, ${redShip.pos.y.toFixed(1)}), target=${redShip.targetId}, intent=${redShip.aiState?.currentIntent}, health=${redShip.health}`);
      debugLog.push(`Blue: pos=(${blueShip.pos.x.toFixed(1)}, ${blueShip.pos.y.toFixed(1)}), target=${blueShip.targetId}, intent=${blueShip.aiState?.currentIntent}, health=${blueShip.health}`);
      debugLog.push(`Distance: ${Math.hypot(redShip.pos.x - blueShip.pos.x, redShip.pos.y - blueShip.pos.y, redShip.pos.z - blueShip.pos.z).toFixed(1)}`);
      debugLog.push(`Bullets: ${state.bullets.length}`);
      
      // Check turret cooldowns
      debugLog.push(`Red turret cooldowns: ${redShip.turrets.map(t => t.cooldownLeft.toFixed(2)).join(', ')}`);
      debugLog.push(`Blue turret cooldowns: ${blueShip.turrets.map(t => t.cooldownLeft.toFixed(2)).join(', ')}`);

      if (state.bullets.length > 0) {
        debugLog.push('*** BULLETS DETECTED! ***');
        bulletsCreated = true;
        break;
      }
    }

    // Show debug output if no bullets were created
    if (!bulletsCreated) {
      // Force test failure with debug info
      expect(false, `No bullets were created during simulation:\n${debugLog.join('\n')}`).toBe(true);
    }

    // Check if ships got targets
    expect(redShip.targetId, 'Red ship should acquire blue ship as target').toBe(blueShip.id);
    expect(blueShip.targetId, 'Blue ship should acquire red ship as target').toBe(redShip.id);
  });
});