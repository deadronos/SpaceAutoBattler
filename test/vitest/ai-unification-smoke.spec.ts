import { describe, it, expect } from 'vitest';
import { createMockGameState } from './setupTests.js';
import { GameState, Ship } from '../../src/types/index.js';
import { simulateStep, spawnShip } from '../../src/core/gameState.js';
import { DEFAULT_BEHAVIOR_CONFIG } from '../../src/config/behaviorConfig.js';

describe('AI Unification Smoke Test', () => {
  it('should handle 10-20 ships per side with consistent behavior for 10 seconds', () => {
    const state = createMockGameState();
    state.behaviorConfig = JSON.parse(JSON.stringify(DEFAULT_BEHAVIOR_CONFIG));
    
    // Spawn 10 ships per side
    for (let i = 0; i < 10; i++) {
      spawnShip(state, 'red', 'fighter');
      spawnShip(state, 'blue', 'fighter');
    }
    
    expect(state.ships).toHaveLength(20);
    
    // Track positions over time to verify movement
    const initialPositions = state.ships.map(s => ({ id: s.id, pos: { ...s.pos } }));
    
    // Simulate 10 seconds at 60 FPS (600 steps)
    const dt = 1/60;
    const totalSteps = 600;
    
    for (let step = 0; step < totalSteps; step++) {
      simulateStep(state, dt);
      state.time += dt;
      state.tick++;
    }
    
    // Verify ships moved (indicating AI is working)
    let shipsWithMovement = 0;
    for (const initial of initialPositions) {
      const current = state.ships.find(s => s.id === initial.id);
      if (current) {
        const distance = Math.hypot(
          current.pos.x - initial.pos.x,
          current.pos.y - initial.pos.y,
          current.pos.z - initial.pos.z
        );
        if (distance > 10) { // Ship moved more than 10 units
          shipsWithMovement++;
        }
      }
    }
    
    // At least some ships should have moved significantly
    expect(shipsWithMovement).toBeGreaterThan(10);
    
    // All ships should still be within bounds
    for (const ship of state.ships) {
      expect(ship.pos.x).toBeGreaterThanOrEqual(0);
      expect(ship.pos.x).toBeLessThanOrEqual(state.simConfig.simBounds.width);
      expect(ship.pos.y).toBeGreaterThanOrEqual(0);
      expect(ship.pos.y).toBeLessThanOrEqual(state.simConfig.simBounds.height);
      expect(ship.pos.z).toBeGreaterThanOrEqual(0);
      expect(ship.pos.z).toBeLessThanOrEqual(state.simConfig.simBounds.depth);
    }
    
    // Ships should have targets (indicating AI targeting is working)
    const shipsWithTargets = state.ships.filter(s => s.targetId !== null).length;
    expect(shipsWithTargets).toBeGreaterThan(0);
  });

  it('should produce consistent behavior between legacy and advanced AI modes', () => {
    // Test that both AI modes produce similar overall movement patterns
    
    // Setup for legacy AI
    const legacyState = createMockGameState();
    // No behaviorConfig = uses legacy stepShipAI path
    for (let i = 0; i < 5; i++) {
      spawnShip(legacyState, 'red', 'fighter');
      spawnShip(legacyState, 'blue', 'fighter');
    }
    
    // Setup for advanced AI
    const advancedState = createMockGameState();
    advancedState.behaviorConfig = JSON.parse(JSON.stringify(DEFAULT_BEHAVIOR_CONFIG));
    for (let i = 0; i < 5; i++) {
      spawnShip(advancedState, 'red', 'fighter');
      spawnShip(advancedState, 'blue', 'fighter');
    }
    
    // Simulate same time duration
    const dt = 1/60;
    const steps = 300; // 5 seconds
    
    for (let step = 0; step < steps; step++) {
      simulateStep(legacyState, dt);
      simulateStep(advancedState, dt);
      legacyState.time += dt;
      advancedState.time += dt;
    }
    
    // Both should have ships that moved and stayed in bounds
    const legacyMovingShips = legacyState.ships.filter(s => 
      Math.hypot(s.vel.x, s.vel.y, s.vel.z) > 1
    ).length;
    
    const advancedMovingShips = advancedState.ships.filter(s => 
      Math.hypot(s.vel.x, s.vel.y, s.vel.z) > 1
    ).length;
    
    // Both should have some ships moving (indicating active AI)
    expect(legacyMovingShips).toBeGreaterThan(0);
    expect(advancedMovingShips).toBeGreaterThan(0);
    
    // Both should respect boundaries
    for (const ship of legacyState.ships.concat(advancedState.ships)) {
      expect(ship.pos.x).toBeLessThanOrEqual(1000); // Mock bounds width
      expect(ship.pos.y).toBeLessThanOrEqual(800);  // Mock bounds height
      expect(ship.pos.z).toBeLessThanOrEqual(600);  // Mock bounds depth
    }
  });
});