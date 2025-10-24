import { describe, it, expect } from 'vitest';
import { getEffectiveProfile } from '../../src/game/systems/decision/profile-adjustment.js';
import { AI_CONFIG } from '../../src/game/config.js';
import type { GameState, ShipEntity, BehaviorProfile } from '../../src/types/index.js';

describe('Profile Adjustment', () => {
  const mockState = {
    ai: {
      tickIndex: 0,
      tickInterval: 0.5,
      teams: {
        blue: {
          units: [],
        },
      },
    },
  } as unknown as GameState;

  const mockShip = {
    ship: { hull: 'fighter', team: 'blue' },
  } as ShipEntity;

  const mockCarrierShip = {
    ship: { hull: 'carrier', team: 'blue' },
  } as ShipEntity;

  const mockDestroyerShip = {
    ship: { hull: 'destroyer', team: 'blue' },
  } as ShipEntity;

  const baseProfile: BehaviorProfile = {
    desiredRange: [100, 200] as const,
    orbit: 0.5,
    aggression: 0.7,
    patience: 0.6,
    dodgeFreq: 0.3,
    classBias: {},
    style: 'brawler',
    verticalManeuver: 0.4,
  };

  describe('getEffectiveProfile', () => {
    it('applies doctrine modifiers when range policy is default', () => {
      const originalPolicy = AI_CONFIG.rangePolicy;
      AI_CONFIG.rangePolicy = 'default';

      const result = getEffectiveProfile(mockState, mockShip, baseProfile);

      expect(result).not.toBe(baseProfile);
      expect(result.desiredRange).toEqual([110, 210]);
      expect(result.aggression).toBeCloseTo(0.63, 5);
      expect(result.patience).toBeCloseTo(0.72, 5);
      expect(result.engagementBias).toBe(4);
      expect(result.bandPreference).toBe('mid');

      AI_CONFIG.rangePolicy = originalPolicy;
    });

    it('adjusts artillery style correctly', () => {
      const originalPolicy = AI_CONFIG.rangePolicy;
      AI_CONFIG.rangePolicy = 'v0.1.1-exp';

      const artilleryProfile: BehaviorProfile = {
        ...baseProfile,
        style: 'artillery',
      };

      const result = getEffectiveProfile(mockState, mockShip, artilleryProfile);

      expect(result.desiredRange).toEqual([140, 260]); // +30, +50 then doctrine +10

      AI_CONFIG.rangePolicy = originalPolicy;
    });

    it('adjusts brawler style correctly', () => {
      const originalPolicy = AI_CONFIG.rangePolicy;
      AI_CONFIG.rangePolicy = 'v0.1.1-exp';

      const brawlerProfile: BehaviorProfile = {
        ...baseProfile,
        style: 'brawler',
      };

      const result = getEffectiveProfile(mockState, mockShip, brawlerProfile);

      // min = max(20, 100-20) = 80, max = max(80+40, 200-10) = 190, doctrine offset +10
      expect(result.desiredRange).toEqual([90, 200]);

      AI_CONFIG.rangePolicy = originalPolicy;
    });

    it('adjusts escort style correctly', () => {
      const originalPolicy = AI_CONFIG.rangePolicy;
      AI_CONFIG.rangePolicy = 'v0.1.1-exp';

      const escortProfile: BehaviorProfile = {
        ...baseProfile,
        style: 'escort',
      };

      const result = getEffectiveProfile(mockState, mockShip, escortProfile);

      // min = max(15, 100-10) = 90, max = max(90+40, 200) = 200, doctrine offset +10
      expect(result.desiredRange).toEqual([100, 210]);

      AI_CONFIG.rangePolicy = originalPolicy;
    });

    it('adjusts kiter style correctly', () => {
      const originalPolicy = AI_CONFIG.rangePolicy;
      AI_CONFIG.rangePolicy = 'v0.1.1-exp';

      const kiterProfile: BehaviorProfile = {
        ...baseProfile,
        style: 'kiter',
      };

      const result = getEffectiveProfile(mockState, mockShip, kiterProfile);

      expect(result.desiredRange).toEqual([120, 240]); // +10, +30 then doctrine +10

      AI_CONFIG.rangePolicy = originalPolicy;
    });

    it('applies carrier hull adjustment', () => {
      const originalPolicy = AI_CONFIG.rangePolicy;
      AI_CONFIG.rangePolicy = 'v0.1.1-exp';

      const result = getEffectiveProfile(mockState, mockCarrierShip, baseProfile);

      expect(result.desiredRange).toEqual([100, 230]); // brawler [80,190] + carrier [+10,+30] then doctrine +10

      AI_CONFIG.rangePolicy = originalPolicy;
    });

    it('applies destroyer hull adjustment', () => {
      const originalPolicy = AI_CONFIG.rangePolicy;
      AI_CONFIG.rangePolicy = 'v0.1.1-exp';

      const result = getEffectiveProfile(mockState, mockDestroyerShip, baseProfile);

      expect(result.desiredRange).toEqual([100, 230]); // brawler [80,190] + destroyer [+10,+30] then doctrine +10

      AI_CONFIG.rangePolicy = originalPolicy;
    });

    it('enforces minimum range span of 40', () => {
      const originalPolicy = AI_CONFIG.rangePolicy;
      AI_CONFIG.rangePolicy = 'v0.1.1-exp';

      const narrowProfile: BehaviorProfile = {
        ...baseProfile,
        desiredRange: [100, 110] as const, // span of 10
      };

      const result = getEffectiveProfile(mockState, mockShip, narrowProfile);

      expect(result.desiredRange[1] - result.desiredRange[0]).toBeGreaterThanOrEqual(40);
      expect(result.desiredRange).toEqual([90, 130]);

      AI_CONFIG.rangePolicy = originalPolicy;
    });

    it('enforces minimum range of 10', () => {
      const originalPolicy = AI_CONFIG.rangePolicy;
      AI_CONFIG.rangePolicy = 'v0.1.1-exp';

      const lowProfile: BehaviorProfile = {
        ...baseProfile,
        desiredRange: [5, 25] as const,
      };

      const result = getEffectiveProfile(mockState, mockShip, lowProfile);

      expect(result.desiredRange[0]).toBeGreaterThanOrEqual(10);
      expect(result.desiredRange).toEqual([30, 70]);

      AI_CONFIG.rangePolicy = originalPolicy;
    });

    it('ensures max > min', () => {
      const originalPolicy = AI_CONFIG.rangePolicy;
      AI_CONFIG.rangePolicy = 'v0.1.1-exp';

      const invalidProfile: BehaviorProfile = {
        ...baseProfile,
        desiredRange: [200, 150] as const, // max < min
      };

      const result = getEffectiveProfile(mockState, mockShip, invalidProfile);

      expect(result.desiredRange[1]).toBeGreaterThan(result.desiredRange[0]);
      expect(result.desiredRange).toEqual([190, 230]);

      AI_CONFIG.rangePolicy = originalPolicy;
    });

    it('combines style and hull adjustments', () => {
      const originalPolicy = AI_CONFIG.rangePolicy;
      AI_CONFIG.rangePolicy = 'v0.1.1-exp';

      const artilleryProfile: BehaviorProfile = {
        ...baseProfile,
        style: 'artillery',
      };

      const result = getEffectiveProfile(mockState, mockCarrierShip, artilleryProfile);

      // Artillery: +30, +50; Carrier: +10, +30; Doctrine: +10, +10; Total: +50, +90
      expect(result.desiredRange).toEqual([150, 290]);

      AI_CONFIG.rangePolicy = originalPolicy;
    });
  });
});
