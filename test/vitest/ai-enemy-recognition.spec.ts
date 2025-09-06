import { describe, it, expect, beforeEach } from 'vitest';
import { createMockGameState, createMockShip, getTestDtFromState } from './setupTests.js';
import { AIController } from '../../src/core/aiController';
import type { GameState, Ship } from '../../src/types';
import { DEFAULT_BEHAVIOR_CONFIG } from '../../src/config/behaviorConfig';

const DEBUG_AI = false; // Set to true for debug output

describe('AI Enemy Recognition', () => {
  let state: GameState;
  let aiController: AIController;

  // Helper to update ships and shipIndex together
  const setShips = (ships: Ship[]) => {
    state.ships = ships;
    if (!state.shipIndex) state.shipIndex = new Map();
    state.shipIndex.clear();
    for (const ship of ships) {
      state.shipIndex.set(ship.id, ship);
    }
    // Rebuild spatial index for accurate neighbor queries in tests
    if (state.spatialGrid && state.behaviorConfig?.globalSettings.enableSpatialIndex) {
      state.spatialGrid.rebuild(state.ships.map(s => ({ id: s.id, pos: s.pos, radius: 16, team: s.team })));
    }
  };

  const addShip = (ship: Ship) => {
    state.ships.push(ship);
    if (!state.shipIndex) state.shipIndex = new Map();
    state.shipIndex.set(ship.id, ship);
    if (state.spatialGrid && state.behaviorConfig?.globalSettings.enableSpatialIndex) {
      state.spatialGrid.rebuild(state.ships.map(s => ({ id: s.id, pos: s.pos, radius: 16, team: s.team })));
    }
  };

  beforeEach(() => {
    state = createMockGameState();
    state.behaviorConfig = { ...DEFAULT_BEHAVIOR_CONFIG };
    aiController = new AIController(state);
  });

  it('should find nearest enemy ship within range', () => {
    // Create red ship
    const redShip: Ship = createMockShip({
      id: 1,
      team: 'red',
      class: 'fighter',
      pos: { x: 100, y: 100, z: 100 },
    }) as unknown as Ship;

    // Create blue ships at different distances
    const nearBlueShip: Ship = createMockShip({
      id: 2,
      team: 'blue',
      class: 'fighter',
      pos: { x: 150, y: 100, z: 100 }, // 50 units away
    }) as unknown as Ship;

    const farBlueShip: Ship = createMockShip({
      id: 3,
      team: 'blue',
      class: 'fighter',
      pos: { x: 300, y: 100, z: 100 }, // 200 units away
    }) as unknown as Ship;

    setShips([redShip, nearBlueShip, farBlueShip]);

  // Update AI which should find nearest enemy
  const dt = getTestDtFromState(state);
  aiController.updateAllShips(dt);
  state.time += dt;

    // Red ship should target the nearest blue ship
    expect(redShip.targetId).toBe(nearBlueShip.id);

    if (DEBUG_AI) {
      console.log(`Red ship ${redShip.id} targeting ${redShip.targetId}, expected ${nearBlueShip.id}`);
    }
  });

  it('should not target enemies outside detection range', () => {
    // Create red ship with limited detection range
    const redShip: Ship = createMockShip({
      id: 1,
      team: 'red',
      class: 'fighter',
      pos: { x: 100, y: 100, z: 100 },
    }) as unknown as Ship;

    // Create blue ship far away (beyond typical detection range)
    const farBlueShip: Ship = createMockShip({
      id: 2,
      team: 'blue',
      class: 'fighter',
      pos: { x: 2000, y: 100, z: 100 }, // Very far away
    }) as unknown as Ship;

    setShips([redShip, farBlueShip]);

  // Update AI
  const dt2 = getTestDtFromState(state);
  aiController.updateAllShips(dt2);
  state.time += dt2;

    // Red ship should not target the far blue ship
    if (DEBUG_AI) console.log(`[Test] Red ship targetId: ${redShip.targetId}`);
    expect(redShip.targetId).toBeNull();

    if (DEBUG_AI) {
      console.log(`Red ship ${redShip.id} targeting ${redShip.targetId}, expected null (too far)`);
    }
  });

  it('should switch targets when a closer enemy appears', () => {
    // Create red ship
    const redShip: Ship = createMockShip({
      id: 1,
      team: 'red',
      class: 'fighter',
      pos: { x: 100, y: 100, z: 100 },
    }) as unknown as Ship;

    // Create initial blue target
    const initialTarget: Ship = createMockShip({
      id: 2,
      team: 'blue',
      class: 'fighter',
      pos: { x: 200, y: 100, z: 100 }, // 100 units away
    }) as unknown as Ship;

    setShips([redShip, initialTarget]);

  // First update - should target initial enemy
  const dt3 = getTestDtFromState(state);
  aiController.updateAllShips(dt3);
  state.time += dt3;
    expect(redShip.targetId).toBe(initialTarget.id);

    // Add a closer enemy
    const closerTarget: Ship = createMockShip({
      id: 3,
      team: 'blue',
      class: 'fighter',
      pos: { x: 130, y: 100, z: 100 }, // 30 units away
    }) as unknown as Ship;

    addShip(closerTarget);
    
    // Increment time and frame to invalidate cache
    state.time = 0.2;
  (state as unknown as { frame: number }).frame = 1;

  // Second update - should switch to closer enemy
  const dt4 = getTestDtFromState(state);
  aiController.updateAllShips(dt4);
  state.time += dt4;
    expect(redShip.targetId).toBe(closerTarget.id);

    if (DEBUG_AI) {
      console.log(`Red ship ${redShip.id} targeting ${redShip.targetId}, expected ${closerTarget.id} (closer)`);
    }
  });

  it('should not target ships of the same team', () => {
    // Create two red ships
    const redShip1: Ship = createMockShip({
      id: 1,
      team: 'red',
      class: 'fighter',
      pos: { x: 100, y: 100, z: 100 },
    }) as unknown as Ship;

    const redShip2: Ship = createMockShip({
      id: 2,
      team: 'red',
      class: 'fighter',
      pos: { x: 120, y: 100, z: 100 }, // Same team, close by
    }) as unknown as Ship;

    setShips([redShip1, redShip2]);

  // Update AI
  const dt5 = getTestDtFromState(state);
  aiController.updateAllShips(dt5);
  state.time += dt5;

    // Neither ship should target the other
    const updatedRedShip1 = state.shipIndex?.get(redShip1.id);
    const updatedRedShip2 = state.shipIndex?.get(redShip2.id);
    expect(updatedRedShip1?.targetId).toBeNull();
    expect(updatedRedShip2?.targetId).toBeNull();

    if (DEBUG_AI) {
      console.log(`Red ships should not target each other: ship1=${redShip1.targetId}, ship2=${redShip2.targetId}`);
    }
  });

  it('should clear target when enemy is destroyed', () => {
    // Create red ship
    const redShip: Ship = createMockShip({
      id: 1,
      team: 'red',
      class: 'fighter',
      pos: { x: 100, y: 100, z: 100 },
      targetId: 2, // Already targeting enemy id 2
    }) as unknown as Ship;

    // Create blue ship
    const blueShip: Ship = createMockShip({
      id: 2,
      team: 'blue',
      class: 'fighter',
      pos: { x: 150, y: 100, z: 100 },
    }) as unknown as Ship;

    setShips([redShip, blueShip]);

  // First update - should maintain target
  const dt6 = getTestDtFromState(state);
  aiController.updateAllShips(dt6);
  state.time += dt6;
    expect(redShip.targetId).toBe(blueShip.id);

    // Remove the blue ship (simulate destruction)
    setShips([redShip]);

  // Second update - should clear target
  const dt7 = getTestDtFromState(state);
  aiController.updateAllShips(dt7);
  state.time += dt7;
    const updatedRedShip = state.shipIndex?.get(redShip.id);
    expect(updatedRedShip?.targetId).toBe(null);

    if (DEBUG_AI) {
      console.log(`Red ship ${redShip.id} targeting ${redShip.targetId}, expected null (enemy destroyed)`);
    }
  });

  it('should handle evade behavior when enemy is found', () => {
    // Create red ship with recent damage (should evade)
    const redShip: Ship = createMockShip({
      id: 1,
      team: 'red',
      class: 'fighter',
      pos: { x: 100, y: 100, z: 100 },
      aiState: {
        currentIntent: 'evade',
        intentEndTime: 999999,
        lastIntentReevaluation: 0,
        preferredRange: 150,
        recentDamage: 25,
        lastDamageTime: 0
      }
    }) as unknown as Ship;

    // Create nearby blue ship
    const blueShip: Ship = createMockShip({
      id: 2,
      team: 'blue',
      class: 'fighter',
      pos: { x: 120, y: 100, z: 100 }, // 20 units away
    }) as unknown as Ship;

    setShips([redShip, blueShip]);

  // Update AI
  const dt8 = getTestDtFromState(state);
  aiController.updateAllShips(dt8);
  state.time += dt8;
    const updatedRedShip = state.shipIndex?.get(redShip.id);

    // Red ship should recognize the blue ship as a threat
    expect(updatedRedShip?.targetId).toBe(blueShip.id);
    expect(updatedRedShip?.aiState?.currentIntent).toBe('evade');

    if (DEBUG_AI) {
      console.log(`Evading ship ${redShip.id} should recognize enemy ${blueShip.id}: targeting=${redShip.targetId}, intent=${redShip.aiState?.currentIntent}`);
    }
  });

  it('should maintain target persistence when enemy is still valid', () => {
    // Create red ship with existing target
    const redShip: Ship = createMockShip({
      id: 1,
      team: 'red',
      class: 'fighter',
      pos: { x: 100, y: 100, z: 100 },
      targetId: 2, // Already targeting enemy id 2
    }) as unknown as Ship;

    // Create the targeted blue ship
    const targetedBlueShip: Ship = createMockShip({
      id: 2,
      team: 'blue',
      class: 'fighter',
      pos: { x: 150, y: 100, z: 100 },
    }) as unknown as Ship;

    setShips([redShip, targetedBlueShip]);

    // Multiple updates should maintain the same target
    for (let i = 0; i < 5; i++) {
      const dt9 = getTestDtFromState(state);
      aiController.updateAllShips(dt9);
      state.time += dt9;
      expect(redShip.targetId).toBe(targetedBlueShip.id);
    }

    if (DEBUG_AI) {
      console.log(`Red ship ${redShip.id} should maintain target ${targetedBlueShip.id}: current=${redShip.targetId}`);
    }
  });
});

