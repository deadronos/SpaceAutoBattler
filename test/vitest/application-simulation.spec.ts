import { describe, it, expect, beforeEach } from 'vitest';
import { createInitialState, spawnFleet, simulateStep, resetState } from '../../src/core/gameState.js';
import { GameState } from '../../src/types/index.js';

describe('Real Application Simulation Test', () => {
  let state: GameState;

  beforeEach(() => {
    state = createInitialState('test-seed');
  });

  it('should behave exactly like the main application', () => {
    // Reset state the same way the main application does
    resetState(state);
    
    // Spawn fleets exactly like the main application does
    spawnFleet(state, 'red', 5);
    spawnFleet(state, 'blue', 5);

    const debugLog: string[] = [];
    debugLog.push('=== APPLICATION SIMULATION TEST ===');
    debugLog.push(`Initial ships: Red=${state.ships.filter(s => s.team === 'red').length}, Blue=${state.ships.filter(s => s.team === 'blue').length}`);
    debugLog.push(`AI Enabled: ${state.behaviorConfig?.globalSettings.aiEnabled}`);

    let totalBullets = 0;
    let maxDistance = 0;
    let minDistance = Infinity;

    // Simulate exactly like the main application does
    const fixedDt = 1 / state.simConfig.tickRate; // 1/60 = 0.01667
    
    for (let i = 0; i < 600; i++) { // ~10 seconds of simulation
      simulateStep(state, fixedDt);
      state.time += fixedDt;
      state.tick++;
      
      // Track bullets created
      totalBullets += state.bullets.length;
      
      // Calculate distances between opposing ships
      const redShips = state.ships.filter(s => s.team === 'red' && s.health > 0);
      const blueShips = state.ships.filter(s => s.team === 'blue' && s.health > 0);
      
      for (const red of redShips) {
        for (const blue of blueShips) {
          const dist = Math.hypot(red.pos.x - blue.pos.x, red.pos.y - blue.pos.y, red.pos.z - blue.pos.z);
          maxDistance = Math.max(maxDistance, dist);
          minDistance = Math.min(minDistance, dist);
        }
      }
      
      // Log every 60 ticks (1 second)
      if (i % 60 === 0) {
        const redAlive = redShips.length;
        const blueAlive = blueShips.length;
        debugLog.push(`Second ${i/60}: Red=${redAlive}, Blue=${blueAlive}, Bullets=${state.bullets.length}, MinDist=${minDistance.toFixed(1)}, MaxDist=${maxDistance.toFixed(1)}`);
        
        // Sample some ships to see their behavior
        if (redAlive > 0) {
          const sampleRed = redShips[0];
          debugLog.push(`  Sample Red ship: pos=(${sampleRed.pos.x.toFixed(1)}, ${sampleRed.pos.y.toFixed(1)}), target=${sampleRed.targetId}, intent=${sampleRed.aiState?.currentIntent}`);
        }
        
        if (blueAlive > 0) {
          const sampleBlue = blueShips[0];
          debugLog.push(`  Sample Blue ship: pos=(${sampleBlue.pos.x.toFixed(1)}, ${sampleBlue.pos.y.toFixed(1)}), target=${sampleBlue.targetId}, intent=${sampleBlue.aiState?.currentIntent}`);
        }
      }
    }

    debugLog.push(`Final summary: Total bullets seen=${totalBullets}, Min distance=${minDistance.toFixed(1)}, Max distance=${maxDistance.toFixed(1)}`);

    // Show debug output if no engagement occurred
    if (totalBullets === 0) {
      expect(false, `No engagement occurred in application simulation:\n${debugLog.join('\n')}`).toBe(true);
    }

    // Should see bullets being created (engagement)
    expect(totalBullets, 'Should see bullets created during fleet combat').toBeGreaterThan(0);
  });
});