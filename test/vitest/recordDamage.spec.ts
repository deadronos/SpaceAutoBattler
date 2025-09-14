import { describe, it, expect } from 'vitest';
import { createInitialState, spawnShip } from '../../src/core/gameState.js';
import { recordDamage } from '../../src/core/gameState.js';
import { XP_PER_DAMAGE } from '../../src/config/progression.js';
import type { GameState } from '../../src/types/index.js';

describe('recordDamage helper', () => {
  it('awards XP to owner and records last damage and aiState fields', () => {
    const state: GameState = createInitialState('test-record-damage');
    const attacker = spawnShip(state, 'red', 'fighter');
    const victim = spawnShip(state, 'blue', 'fighter');

    // sanity checks
    expect(attacker.level.xp).toBe(0);
    expect(victim.lastDamageBy).toBeUndefined();
    expect(victim.lastDamageTime).toBeUndefined();

    const damage = 10;
    // Ensure some non-zero state.time to validate lastDamageTime behavior
    state.time = 123.5;

    recordDamage(state, victim, damage, attacker.id);

    // XP awarded to attacker
    expect(attacker.level.xp).toBeCloseTo(damage * XP_PER_DAMAGE);

    // Victim last damage fields
    expect(victim.lastDamageBy).toBe(attacker.id);
    expect(victim.lastDamageTime).toBe(state.time);

    // aiState should exist and be updated
    expect(victim.aiState).toBeDefined();
    expect(victim.aiState!.recentDamage).toBeGreaterThanOrEqual(damage);
    expect(victim.aiState!.lastDamageTime).toBe(state.time);
  });

  it('records lastDamageBy id even if owner not in state.shipIndex (no XP awarded)', () => {
    const state: GameState = createInitialState('test-record-damage-2');
    const victim = spawnShip(state, 'blue', 'fighter');

    state.time = 10;
    const damage = 5;
    const fakeOwnerId = 999999; // not present

    // Capture current XP sums to detect no change
    const totalXpBefore = state.ships.reduce((s, sh) => s + (sh.level?.xp ?? 0), 0);

    recordDamage(state, victim, damage, fakeOwnerId);

    // lastDamageBy should still be the id provided
    expect(victim.lastDamageBy).toBe(fakeOwnerId);
    expect(victim.lastDamageTime).toBe(state.time);

    // No XP awarded (sum unchanged)
    const totalXpAfter = state.ships.reduce((s, sh) => s + (sh.level?.xp ?? 0), 0);
    expect(totalXpAfter).toBeCloseTo(totalXpBefore);

    // aiState updated
    expect(victim.aiState).toBeDefined();
    expect(victim.aiState!.recentDamage).toBeGreaterThanOrEqual(damage);
    expect(victim.aiState!.lastDamageTime).toBe(state.time);
  });
});
