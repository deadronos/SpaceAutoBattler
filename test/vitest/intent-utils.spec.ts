import { describe, it, expect } from 'vitest';
import {
  getDistanceBetween,
  getHpRatio,
  getEffectiveAggression,
  getEffectivePatience,
  getOpeningSalvoMultiplier,
  getFocusFireLoad,
  getPriorityRank,
} from '../../src/game/systems/decision/intent-utils.js';
import type { ShipEntity, BehaviorProfile, AITraits, GameState } from '../../src/types/index.js';

describe('intent-utils helper functions', () => {
  describe('getDistanceBetween', () => {
    it('calculates distance between two ships', () => {
      const ship1 = {
        transform: {
          position: {
            x: 0,
            y: 0,
            z: 0,
            distanceTo: (other: any) => Math.sqrt(other.x ** 2 + other.y ** 2 + other.z ** 2),
          },
        },
      } as ShipEntity;

      const ship2 = {
        transform: {
          position: { x: 3, y: 4, z: 0 },
        },
      } as ShipEntity;

      const distance = getDistanceBetween(ship1, ship2);
      expect(distance).toBe(5);
    });
  });

  describe('getHpRatio', () => {
    it('calculates HP ratio correctly', () => {
      const ship = {
        ship: {
          hp: 50,
          maxHp: 100,
        },
      } as ShipEntity;

      expect(getHpRatio(ship)).toBe(0.5);
    });

    it('handles zero maxHp safely', () => {
      const ship = {
        ship: {
          hp: 10,
          maxHp: 0,
        },
      } as ShipEntity;

      expect(getHpRatio(ship)).toBe(10);
    });

    it('returns 1.0 for full health', () => {
      const ship = {
        ship: {
          hp: 100,
          maxHp: 100,
        },
      } as ShipEntity;

      expect(getHpRatio(ship)).toBe(1.0);
    });
  });

  describe('getEffectiveAggression', () => {
    it('multiplies profile aggression by trait aggression', () => {
      const profile = { aggression: 0.8 } as BehaviorProfile;
      const traits = { aggression: 1.2 } as AITraits;

      expect(getEffectiveAggression(profile, traits)).toBe(0.96);
    });

    it('handles neutral values', () => {
      const profile = { aggression: 1.0 } as BehaviorProfile;
      const traits = { aggression: 1.0 } as AITraits;

      expect(getEffectiveAggression(profile, traits)).toBe(1.0);
    });
  });

  describe('getEffectivePatience', () => {
    it('multiplies profile patience by trait patience', () => {
      const profile = { patience: 0.7 } as BehaviorProfile;
      const traits = { patience: 1.3 } as AITraits;

      expect(getEffectivePatience(profile, traits)).toBeCloseTo(0.91, 2);
    });
  });

  describe('getOpeningSalvoMultiplier', () => {
    it('returns boost multiplier during opening salvo', () => {
      const state = {
        time: 5,
      } as GameState;

      const multiplier = getOpeningSalvoMultiplier(state);
      expect(multiplier).toBeGreaterThanOrEqual(1.0);
    });

    it('returns 1.0 after opening salvo period', () => {
      const state = {
        time: 100,
      } as GameState;

      const multiplier = getOpeningSalvoMultiplier(state);
      expect(multiplier).toBe(1.0);
    });
  });

  describe('getFocusFireLoad', () => {
    it('returns focus fire count for a target', () => {
      const state = {
        blackboard: {
          focusFire: {
            blue: new Map([[5, 3]]),
          },
        },
      } as GameState;

      expect(getFocusFireLoad(state, 'blue', 5)).toBe(3);
    });

    it('returns 0 when target not in focus map', () => {
      const state = {
        blackboard: {
          focusFire: {
            blue: new Map([[5, 3]]),
          },
        },
      } as GameState;

      expect(getFocusFireLoad(state, 'blue', 10)).toBe(0);
    });

    it('returns 0 when focus map does not exist', () => {
      const state = {
        blackboard: {},
      } as GameState;

      expect(getFocusFireLoad(state, 'blue', 5)).toBe(0);
    });
  });

  describe('getPriorityRank', () => {
    it('returns priority rank for a target', () => {
      const state = {
        blackboard: {
          priorityIndex: {
            blue: new Map([[5, 2]]),
          },
        },
      } as GameState;

      expect(getPriorityRank(state, 'blue', 5)).toBe(2);
    });

    it('returns null when target not in priority index', () => {
      const state = {
        blackboard: {
          priorityIndex: {
            blue: new Map([[5, 2]]),
          },
        },
      } as GameState;

      expect(getPriorityRank(state, 'blue', 10)).toBeNull();
    });

    it('returns null when priority index does not exist', () => {
      const state = {
        blackboard: {},
      } as GameState;

      expect(getPriorityRank(state, 'blue', 5)).toBeNull();
    });

    it('returns null for non-finite rank values', () => {
      const state = {
        blackboard: {
          priorityIndex: {
            blue: new Map([[5, NaN]]),
          },
        },
      } as GameState;

      expect(getPriorityRank(state, 'blue', 5)).toBeNull();
    });
  });
});
