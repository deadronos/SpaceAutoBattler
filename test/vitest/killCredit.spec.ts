import { describe, it, expect, vi } from 'vitest';
import { createInitialState, spawnShip, simulateStep } from '../../src/core/gameState.js';
import type { GameState } from '../../src/types/index.js';
import { ShipVisualConfig } from '../../src/config/shipVisualConfig.js';

// Small helper to simulate a bullet hit by directly mutating ship health and setting lastDamageBy/time
function simulateDamage(
  state: GameState,
  victimId: number,
  attackerId: number,
  damage: number,
  timeOffset = 0,
) {
  const victim = state.shipIndex?.get(victimId) ?? state.ships.find((s) => s.id === victimId);
  const attacker = state.shipIndex?.get(attackerId) ?? state.ships.find((s) => s.id === attackerId);
  if (!victim || !attacker) throw new Error('ship missing');
  // Apply damage
  victim.health -= damage;
  // Award XP for damage to attacker
  attacker.level.xp += damage * 1; // XP_PER_DAMAGE is 1 in config in many tests; we don't rely on constant here
  // Record last damage
  victim.lastDamageBy = attacker.id;
  victim.lastDamageTime = state.time + timeOffset;
}

describe('kill crediting', () => {
  it('credits kill to recent damager when within window', () => {
    const state = createInitialState('test-seed');
    // create two ships
    const s1 = spawnShip(state, 'red', 'fighter');
    const s2 = spawnShip(state, 'blue', 'fighter');

    // s1 deals damage to s2
    simulateDamage(state, s2.id, s1.id, 9999, 0);

    // process deaths and XP
    // We call processDeathsAndXP indirectly by calling simulateStep; but that's heavy.
    // Instead import the function? It's not exported; mimic minimal logic by calling the public simulateStep.
    // Use a small dt to avoid other side effects
    // We advance time so state.time matches lastDamageTime window
    state.time += 1;
    // run a simulate step to trigger processDeathsAndXP via simulateStep
    // Call simulateStep which triggers death processing
    simulateStep(state, 1 / state.simConfig.tickRate);

    // After step, s1 should have a kill
    const attacker = state.shipIndex?.get(s1.id) ?? state.ships.find((s) => s.id === s1.id);
    expect(attacker?.kills).toBeGreaterThanOrEqual(1);
  });

  it('does not credit stale damager', () => {
    const state = createInitialState('test-seed-2');
    const s1 = spawnShip(state, 'red', 'fighter');
    const s2 = spawnShip(state, 'blue', 'fighter');

    // s1 damaged s2 long ago
    simulateDamage(state, s2.id, s1.id, 10, -100); // lastDamageTime well in the past

    // Advance time
    state.time += 200;
    simulateStep(state, 1 / state.simConfig.tickRate);

    const attacker = state.shipIndex?.get(s1.id) ?? state.ships.find((s) => s.id === s1.id);
    // attacker should not have credited kill here
    expect(attacker?.kills).toBe(0);
  });

  it('respects configurable kill credit window', () => {
    const state = createInitialState('test-seed-3');
    const s1 = spawnShip(state, 'red', 'fighter');
    const s2 = spawnShip(state, 'blue', 'fighter');

    // Set short window so old damage is ignored
    if (state.behaviorConfig) state.behaviorConfig.globalSettings.killCreditWindowSeconds = 1;

    // s1 damaged s2 2 seconds ago
    simulateDamage(state, s2.id, s1.id, 9999, -2);
    state.time += 2;
    simulateStep(state, 1 / state.simConfig.tickRate);

    const attacker = state.shipIndex?.get(s1.id) ?? state.ships.find((s) => s.id === s1.id);
    expect(attacker?.kills).toBe(0);
  });

  it('triggers explosion effects when a ship dies', async () => {
    const state = createInitialState('death-explosion');
    const attacker = spawnShip(state, 'red', 'fighter');
    const victim = spawnShip(state, 'blue', 'fighter');

    const handleExplosion = vi.fn(async () => {});
    (state as any).unifiedFX = {
      initDone: true,
      effects: null,
      animation: null,
      bvh: null,
      update: () => {},
      handleShipSpawn: async () => {},
      handleShipDestruction: async () => {},
      handleExplosion,
      setQuality: () => {},
      dispose: () => {},
    };

    // Ensure the victim dies this step
    victim.health = -1;
    victim.lastDamageBy = attacker.id;
    victim.lastDamageTime = state.time;

    const dt = 1 / state.simConfig.tickRate;
    simulateStep(state, dt);

    expect(handleExplosion).toHaveBeenCalledTimes(1);
    const expectedIntensity = Math.max(
      0.8,
      ShipVisualConfig.ships[victim.class].collisionRadius / 10,
    );
    expect(handleExplosion).toHaveBeenCalledWith(
      { x: victim.pos.x, y: victim.pos.y, z: victim.pos.z },
      expectedIntensity,
    );
  });
});
