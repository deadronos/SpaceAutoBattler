/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { createMockGameState, TEST_DEFAULTS } from './setupTests.js';
import { simulateStep } from '../../src/core/gameState.js';
import { spawnShip } from '../../src/core/gameState.js';
import type { GameState } from '../../src/types/index.js';
import { RendererConfig } from '../../src/config/rendererConfig.js';

describe('AI Worker Integration', () => {
  let state: GameState;
  let originalUseSimWorker: boolean | undefined;
  let originalUseAIWorker: boolean | undefined;

  beforeEach(() => {
    // Store original config values
    originalUseSimWorker = RendererConfig.useSimWorker;
    originalUseAIWorker = RendererConfig.useAIWorker;
    
    state = createMockGameState();
    
    // Spawn test ships
    const ship1 = spawnShip(state, 'red', 'fighter');
    const ship2 = spawnShip(state, 'blue', 'fighter');
    
    ship1.pos = { x: 100, y: 100, z: 100 };
    ship2.pos = { x: 200, y: 100, z: 100 };
    
    // Initialize AI state
    ship1.aiState = {
      currentIntent: 'idle',
      intentEndTime: 0,
      lastIntentReevaluation: 0,
      preferredRange: TEST_DEFAULTS.preferredRange,
      recentDamage: 0,
      lastDamageTime: 0
    };
    
    ship2.aiState = {
      currentIntent: 'idle',
      intentEndTime: 0,
      lastIntentReevaluation: 0,
      preferredRange: TEST_DEFAULTS.preferredRange,
      recentDamage: 0,
      lastDamageTime: 0
    };
  });

  afterEach(() => {
    // Restore original config values
    (RendererConfig as any).useSimWorker = originalUseSimWorker;
    (RendererConfig as any).useAIWorker = originalUseAIWorker;
  });

  test('should use direct AI when worker is disabled', () => {
    // Disable AI worker
    (RendererConfig as any).useAIWorker = false;
    
    // Run simulation step
    simulateStep(state, 0.1);
    
    // Should create aiController instance
    expect(state.aiController).toBeDefined();
    
    // Ships should have targets assigned (basic functionality test)
    const ship1 = state.ships[0];
    const ship2 = state.ships[1];
    
    // Run multiple steps to ensure AI targeting works
    for (let i = 0; i < 5; i++) {
      simulateStep(state, 0.1);
    }
    
    // At least one ship should have acquired a target by now
    const hasTargets = state.ships.some(ship => ship.targetId !== null && ship.targetId !== undefined);
    expect(hasTargets).toBe(true);
  });

  test('should attempt to use AI worker when enabled but fall back gracefully', () => {
    // Enable AI worker mode
    (RendererConfig as any).useSimWorker = true;
    (RendererConfig as any).useAIWorker = true;
    
    // Mock physicsStepper with stepAI function
    const mockStepAI = vi.fn();
    state.physicsStepper = {
      initDone: true,
      step: vi.fn(),
      stepAI: mockStepAI,
      dispose: vi.fn()
    };
    
    // Run simulation step
    simulateStep(state, 0.1);
    
    // Should call worker stepAI
    expect(mockStepAI).toHaveBeenCalledWith(0.1);
  });

  test('should fall back to direct AI when worker fails', () => {
    // Enable AI worker mode
    (RendererConfig as any).useSimWorker = true;
    (RendererConfig as any).useAIWorker = true;
    
    // Mock physicsStepper with failing stepAI function
    const mockStepAI = vi.fn(() => {
      throw new Error('Worker failure');
    });
    
    state.physicsStepper = {
      initDone: true,
      step: vi.fn(),
      stepAI: mockStepAI,
      dispose: vi.fn()
    };
    
    // Run simulation step
    simulateStep(state, 0.1);
    
    // Should attempt worker call
    expect(mockStepAI).toHaveBeenCalledWith(0.1);
    
    // Should fall back and create direct AI controller
    expect(state.aiController).toBeDefined();
  });

  test('should use direct AI when physicsStepper is not available', () => {
    // Enable AI worker mode but no physicsStepper
    (RendererConfig as any).useSimWorker = true;
    (RendererConfig as any).useAIWorker = true;
    state.physicsStepper = undefined;
    
    // Run simulation step
    simulateStep(state, 0.1);
    
    // Should create direct AI controller
    expect(state.aiController).toBeDefined();
  });

  test('should maintain consistent AI behavior between modes', () => {
    // Test with direct AI first
    (RendererConfig as any).useAIWorker = false;
    
    const state1 = createMockGameState();
    const ship1a = spawnShip(state1, 'red', 'fighter');
    const ship1b = spawnShip(state1, 'blue', 'fighter');
    ship1a.pos = { x: 100, y: 100, z: 100 };
    ship1b.pos = { x: 200, y: 100, z: 100 };
    
    // Initialize AI state
    ship1a.aiState = {
      currentIntent: 'idle',
      intentEndTime: 0,
      lastIntentReevaluation: 0,
      preferredRange: TEST_DEFAULTS.preferredRange,
      recentDamage: 0,
      lastDamageTime: 0
    };
    
    ship1b.aiState = {
      currentIntent: 'idle',
      intentEndTime: 0,
      lastIntentReevaluation: 0,
      preferredRange: TEST_DEFAULTS.preferredRange,
      recentDamage: 0,
      lastDamageTime: 0
    };
    
    // Run several steps with direct AI
    for (let i = 0; i < 10; i++) {
      simulateStep(state1, 0.1);
    }
    
    const directTargets = state1.ships.map(s => s.targetId);
    
    // Test with worker mode (but fallback to direct due to no real worker)
    (RendererConfig as any).useAIWorker = true;
    
    const state2 = createMockGameState();
    const ship2a = spawnShip(state2, 'red', 'fighter');
    const ship2b = spawnShip(state2, 'blue', 'fighter');
    ship2a.pos = { x: 100, y: 100, z: 100 };
    ship2b.pos = { x: 200, y: 100, z: 100 };
    
    // Initialize AI state identically
    ship2a.aiState = {
      currentIntent: 'idle',
      intentEndTime: 0,
      lastIntentReevaluation: 0,
      preferredRange: TEST_DEFAULTS.preferredRange,
      recentDamage: 0,
      lastDamageTime: 0
    };
    
    ship2b.aiState = {
      currentIntent: 'idle',
      intentEndTime: 0,
      lastIntentReevaluation: 0,
      preferredRange: TEST_DEFAULTS.preferredRange,
      recentDamage: 0,
      lastDamageTime: 0
    };
    
    // Run same number of steps 
    for (let i = 0; i < 10; i++) {
      simulateStep(state2, 0.1);
    }
    
    const workerTargets = state2.ships.map(s => s.targetId);
    
    // Since we're using deterministic RNG and same setup, targets should be similar
    // (may not be identical due to fallback timing, but should both assign targets)
    expect(directTargets).toEqual(workerTargets);
  });
});