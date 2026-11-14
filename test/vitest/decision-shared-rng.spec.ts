import { describe, it, expect } from 'vite-plus/test';
import { Vector3 } from 'three';
import type { AIState, ShipEntity } from '../../src/types/index.js';
import { SeededRng } from '../../src/utils/rng.js';
import {
  seededFloat,
  seededNormal,
  seededRange,
} from '../../src/game/systems/decision/sharedRng.js';
import { computeEscortShellOffset } from '../../src/game/systems/decision/blackboard/escortOffset.js';
import { applyVerticalPerturbation } from '../../src/game/systems/decision/vertical-maneuvers.js';
import { resolveBehaviorProfile } from '../../src/game/aiProfiles.js';
import { createMockGameState, createMockShipEntity } from '../fixtures/gameStateFactory.js';

describe('stateless decision RNG helpers', () => {
  it('seededFloat is deterministic, order-independent, and matches SeededRng steps', () => {
    const seed = 98765;
    const rng = new SeededRng(seed);
    const expected0 = rng.next();
    const expected1 = rng.next();
    const expected2 = rng.next();

    // Call out of order and with interleaved seeds to verify no shared state exists.
    expect(seededFloat(seed, 2)).toBe(expected2);
    expect(seededFloat(12345, 0)).not.toBe(expected0);
    expect(seededFloat(seed, 0)).toBe(expected0);
    expect(seededFloat(seed, 1)).toBe(expected1);
    expect(seededFloat(seed)).toBe(expected0);
  });

  it('handles edge-case seeds (0, negative, 0x7fffffff, NaN) safely without hanging', () => {
    for (const seed of [0, -1, -2147483648, 0x7fffffff, Number.NaN]) {
      const f = seededFloat(seed, 0);
      expect(f).toBeGreaterThan(0);
      expect(f).toBeLessThan(1);

      const n = seededNormal(seed, 0.25, 0.05);
      expect(Number.isFinite(n)).toBe(true);
    }
  });

  it('seededRange stays within [min, max) and matches SeededRng.range', () => {
    const seed = 4242;
    const rng = new SeededRng(seed);
    const first = rng.range(-0.08, 0.08);
    const second = rng.range(-0.12, 0.12);

    expect(seededRange(seed, -0.12, 0.12, 1)).toBe(second);
    expect(seededRange(seed, -0.08, 0.08, 0)).toBe(first);

    for (let step = 0; step < 25; step += 1) {
      const value = seededRange(seed, -5, 10, step);
      expect(value).toBeGreaterThanOrEqual(-5);
      expect(value).toBeLessThan(10);
    }
  });

  it('seededNormal is deterministic and matches SeededRng.normal', () => {
    const seed = 314159;
    const mean = 0.3;
    const stdDev = 0.05;
    const rng = new SeededRng(seed);
    const expected = rng.normal(mean, stdDev);

    expect(seededNormal(seed, mean, stdDev)).toBe(expected);
    // Repeated invocations with unrelated calls in between yield identical output.
    seededNormal(777, 10, 2);
    expect(seededNormal(seed, mean, stdDev)).toBe(expected);
  });

  it('computeEscortShellOffset and applyVerticalPerturbation are invariant to call ordering', () => {
    const offsetA1 = computeEscortShellOffset(10, 2, 5, 80);
    const offsetOther = computeEscortShellOffset(99, 0, 3, 120);
    const offsetA2 = computeEscortShellOffset(10, 2, 5, 80);

    expect(offsetA2.toArray()).toEqual(offsetA1.toArray());
    expect(offsetOther.length()).toBeGreaterThanOrEqual(20);

    const state = createMockGameState();
    state.ai.tickIndex = 7;
    const ship = createMockShipEntity(5, 'blue', new Vector3(0, 0, 0)) as ShipEntity;
    const profile = resolveBehaviorProfile('escort');
    const ai: AIState = {
      profileId: 'escort',
      intent: 'Attack',
      nextThinkAt: 0,
      cooldowns: { dodgeAt: 0, burstAt: 0 },
      lod: 0,
      traitSeed: 123456,
      traits: { aggression: 1, patience: 1, dodge: 1 },
      command: { heading: new Vector3(1, 0, 0), thrust: 1, firePrimary: false, ttl: 0.1 },
      stickinessUntil: 0,
      stickinessHeading: new Vector3(1, 0, 0),
    };

    const heading1 = new Vector3(1, 0, 0);
    applyVerticalPerturbation(state, ship, ai, profile, heading1, null);

    // Interleave a different ship/tick call, then repeat the original call.
    const headingOther = new Vector3(0, 0, 1);
    applyVerticalPerturbation(
      state,
      { ...ship, id: 88 },
      { ...ai, traitSeed: 999 },
      profile,
      headingOther,
      null,
    );

    const heading2 = new Vector3(1, 0, 0);
    applyVerticalPerturbation(state, ship, ai, profile, heading2, null);

    expect(heading2.toArray()).toEqual(heading1.toArray());
  });
});
