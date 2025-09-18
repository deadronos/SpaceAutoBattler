/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, test, expect, beforeEach } from 'vitest';
import { createMockGameState, TEST_DEFAULTS } from './setupTests.js';
import { simulateStep, spawnShip } from '../../src/core/gameState.js';
import type { GameState } from '../../src/types/index.js';
import { RendererConfig } from '../../src/config/rendererConfig.js';

describe('AI Worker Determinism', () => {
  let originalUseSimWorker: boolean | undefined;
  let originalUseAIWorker: boolean | undefined;

  beforeEach(() => {
    // Store original config values
    originalUseSimWorker = RendererConfig.useSimWorker;
    originalUseAIWorker = RendererConfig.useAIWorker;
  });

  afterEach(() => {
    // Restore original config values
    (RendererConfig as any).useSimWorker = originalUseSimWorker;
    (RendererConfig as any).useAIWorker = originalUseAIWorker;
  });

  function createDeterministicTestState(seed = 'test-seed'): GameState {
    const state = createMockGameState(seed);
    
    // Spawn ships in deterministic positions
    const redShip = spawnShip(state, 'red', 'fighter');
    const blueShip = spawnShip(state, 'blue', 'fighter');
    
    redShip.pos = { x: 100, y: 100, z: 100 };
    blueShip.pos = { x: 300, y: 100, z: 100 };
    
    // Initialize AI state deterministically
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
    
    return state;
  }

  function captureStateSnapshot(state: GameState) {
    return {
      ships: state.ships.map(ship => ({
        id: ship.id,
        pos: { ...ship.pos },
        vel: { ...ship.vel },
        targetId: ship.targetId,
        health: ship.health,
        team: ship.team
      })),
      bullets: state.bullets.map(bullet => ({
        id: bullet.id,
        pos: { ...bullet.pos },
        vel: { ...bullet.vel },
        ownerShipId: bullet.ownerShipId,
        damage: bullet.damage
      })),
      time: state.time,
      tick: state.tick
    };
  }

  test('direct AI mode should be deterministic across runs', () => {
    // Force direct AI mode
    (RendererConfig as any).useAIWorker = false;
    
    // Run simulation 1
    const state1 = createDeterministicTestState('determinism-test');
    const snapshots1: any[] = [];
    
    for (let i = 0; i < 10; i++) {
      simulateStep(state1, 0.1);
      snapshots1.push(captureStateSnapshot(state1));
    }
    
    // Run simulation 2 with same seed
    const state2 = createDeterministicTestState('determinism-test');
    const snapshots2: any[] = [];
    
    for (let i = 0; i < 10; i++) {
      simulateStep(state2, 0.1);
      snapshots2.push(captureStateSnapshot(state2));
    }
    
    // Should be identical
    expect(snapshots2).toEqual(snapshots1);
  });

  test('worker AI mode (fallback) should be deterministic across runs', () => {
    // Enable worker mode (but will fallback to direct since no real worker)
    (RendererConfig as any).useSimWorker = true;
    (RendererConfig as any).useAIWorker = true;
    
    // Run simulation 1
    const state1 = createDeterministicTestState('worker-determinism-test');
    const snapshots1: any[] = [];
    
    for (let i = 0; i < 10; i++) {
      simulateStep(state1, 0.1);
      snapshots1.push(captureStateSnapshot(state1));
    }
    
    // Run simulation 2 with same seed
    const state2 = createDeterministicTestState('worker-determinism-test');
    const snapshots2: any[] = [];
    
    for (let i = 0; i < 10; i++) {
      simulateStep(state2, 0.1);
      snapshots2.push(captureStateSnapshot(state2));
    }
    
    // Should be identical
    expect(snapshots2).toEqual(snapshots1);
  });

  test('direct vs worker mode should produce identical results (determinism)', () => {
    // Test direct mode
    (RendererConfig as any).useAIWorker = false;
    const state1 = createDeterministicTestState('cross-mode-test');
    const directSnapshots: any[] = [];
    
    for (let i = 0; i < 5; i++) {
      simulateStep(state1, 0.1);
      directSnapshots.push(captureStateSnapshot(state1));
    }
    
    // Test worker mode (fallback)
    (RendererConfig as any).useAIWorker = true;
    const state2 = createDeterministicTestState('cross-mode-test');
    const workerSnapshots: any[] = [];
    
    for (let i = 0; i < 5; i++) {
      simulateStep(state2, 0.1);
      workerSnapshots.push(captureStateSnapshot(state2));
    }
    
    // Should produce identical results since both use same deterministic AI code
    expect(workerSnapshots).toEqual(directSnapshots);
  });

  test('AI targeting decisions should be deterministic', () => {
    (RendererConfig as any).useAIWorker = false;
    
    const state1 = createDeterministicTestState('targeting-test');
    const state2 = createDeterministicTestState('targeting-test');
    
    // Run enough steps for AI to make targeting decisions
    for (let i = 0; i < 15; i++) {
      simulateStep(state1, 0.1);
      simulateStep(state2, 0.1);
    }
    
    // Check that targeting decisions are identical
    for (let i = 0; i < state1.ships.length; i++) {
      expect(state1.ships[i].targetId).toBe(state2.ships[i].targetId);
    }
  });

  test('RNG usage should be consistent between AI modes', () => {
    // Create states with identical RNG seeds
    const directState = createDeterministicTestState('rng-consistency');
    const workerState = createDeterministicTestState('rng-consistency');
    
    // Force different AI modes
    (RendererConfig as any).useAIWorker = false;
    for (let i = 0; i < 5; i++) {
      simulateStep(directState, 0.1);
    }
    
    (RendererConfig as any).useAIWorker = true;
    for (let i = 0; i < 5; i++) {
      simulateStep(workerState, 0.1);
    }
    
    // RNG state should advance similarly (ships should have similar positions/velocities)
    for (let i = 0; i < directState.ships.length; i++) {
      const directShip = directState.ships[i];
      const workerShip = workerState.ships[i];
      
      // Positions should be very close (within floating point precision)
      expect(Math.abs(directShip.pos.x - workerShip.pos.x)).toBeLessThan(1e-10);
      expect(Math.abs(directShip.pos.y - workerShip.pos.y)).toBeLessThan(1e-10);
      expect(Math.abs(directShip.pos.z - workerShip.pos.z)).toBeLessThan(1e-10);
    }
  });
});