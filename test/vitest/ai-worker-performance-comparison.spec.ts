/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, test, expect } from 'vitest';
import { createMockGameState, TEST_DEFAULTS } from './setupTests.js';
import { simulateStep, spawnShip } from '../../src/core/gameState.js';
import type { GameState } from '../../src/types/index.js';
import { RendererConfig } from '../../src/config/rendererConfig.js';

describe('AI Worker vs Direct Mode Performance Comparison', () => {
  function createComparisonTestState(): GameState {
    const state = createMockGameState('perf-comparison');
    
    // Create a realistic scenario with 10 ships
    for (let i = 0; i < 5; i++) {
      const redShip = spawnShip(state, 'red', 'fighter');
      const blueShip = spawnShip(state, 'blue', 'fighter');
      
      redShip.pos = { x: 100 + i * 30, y: 100, z: 100 };
      blueShip.pos = { x: 400 + i * 30, y: 100, z: 100 };
      
      // Initialize AI state
      redShip.aiState = {
        currentIntent: 'idle',
        intentEndTime: 0,
        lastIntentReevaluation: 0,
        preferredRange: TEST_DEFAULTS.preferredRange,
        recentDamage: 0,
        lastDamageTime: 0
      };
      
      blueShip.aiState = {
        currentIntent: 'idle',
        intentEndTime: 0,
        lastIntentReevaluation: 0,
        preferredRange: TEST_DEFAULTS.preferredRange,
        recentDamage: 0,
        lastDamageTime: 0
      };
    }
    
    return state;
  }

  test('performance comparison: direct AI vs worker AI (fallback)', () => {
    const iterations = 100;
    
    // Test direct AI mode
    (RendererConfig as any).useAIWorker = false;
    const directState = createComparisonTestState();
    
    const directStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      simulateStep(directState, 0.1);
    }
    const directTime = performance.now() - directStart;
    
    // Test worker AI mode (fallback to direct)
    (RendererConfig as any).useAIWorker = true;
    const workerState = createComparisonTestState();
    
    const workerStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      simulateStep(workerState, 0.1);
    }
    const workerTime = performance.now() - workerStart;
    
    console.log(`Performance Comparison (${iterations} steps):`);
    console.log(`Direct AI:  ${directTime.toFixed(2)}ms (${(directTime/iterations).toFixed(2)}ms per step)`);
    console.log(`Worker AI:  ${workerTime.toFixed(2)}ms (${(workerTime/iterations).toFixed(2)}ms per step)`);
    console.log(`Difference: ${(workerTime - directTime).toFixed(2)}ms (${((workerTime/directTime - 1) * 100).toFixed(1)}% ${workerTime > directTime ? 'slower' : 'faster'})`);
    
    // Both should complete in reasonable time
    expect(directTime).toBeLessThan(10000); // Less than 10 seconds
    expect(workerTime).toBeLessThan(10000); // Less than 10 seconds
    
    // Difference should not be dramatic (within 50% either way)
    const ratio = workerTime / directTime;
    expect(ratio).toBeGreaterThan(0.5);
    expect(ratio).toBeLessThan(2.0);
    
    // Both modes should have ships with targets
    expect(directState.ships.some(s => s.targetId !== null)).toBe(true);
    expect(workerState.ships.some(s => s.targetId !== null)).toBe(true);
  });
});