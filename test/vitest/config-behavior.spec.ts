import { describe, test, expect } from 'vitest';
import {
  DEFAULT_PERSONALITIES,
  DEFAULT_TURRET_CONFIG,
  DEFAULT_ROAMING_PATTERNS,
  DEFAULT_FORMATIONS,
  DEFAULT_BEHAVIOR_CONFIG,
  getEffectivePersonality,
  selectRoamingPattern,
  getFormationConfig
} from '../../src/config/behaviorConfig.js';
import type { ShipClass, Team } from '../../src/types/index.js';

// Test utilities
function validateConfigStructure(config: any, expectedKeys: string[]) {
  expectedKeys.forEach(key => {
    expect(config).toHaveProperty(key);
  });
}

describe('Behavior Configuration', () => {
  describe('AI Personalities', () => {
    test('should have personalities for all ship classes', () => {
      const expectedClasses: ShipClass[] = ['fighter', 'corvette', 'frigate', 'destroyer', 'carrier'];

      expectedClasses.forEach(shipClass => {
        expect(DEFAULT_PERSONALITIES).toHaveProperty(shipClass);
      });
    });

    test('should have valid personality structure', () => {
      Object.values(DEFAULT_PERSONALITIES).forEach(personality => {
        validateConfigStructure(personality, [
          'mode', 'intentReevaluationRate', 'minIntentDuration', 'maxIntentDuration',
          'aggressiveness', 'caution', 'groupCohesion', 'preferredRangeMultiplier'
        ]);

        expect(personality.intentReevaluationRate).toBeGreaterThan(0);
        expect(personality.minIntentDuration).toBeGreaterThan(0);
        expect(personality.maxIntentDuration).toBeGreaterThanOrEqual(personality.minIntentDuration);
        expect(personality.aggressiveness).toBeGreaterThanOrEqual(0);
        expect(personality.aggressiveness).toBeLessThanOrEqual(1);
        expect(personality.caution).toBeGreaterThanOrEqual(0);
        expect(personality.caution).toBeLessThanOrEqual(1);
        expect(personality.groupCohesion).toBeGreaterThanOrEqual(0);
        expect(personality.groupCohesion).toBeLessThanOrEqual(1);
        expect(personality.preferredRangeMultiplier).toBeGreaterThan(0);
      });
    });

    test('should have appropriate personality traits per ship class', () => {
      // Fighters should be aggressive and maneuverable
      const fighter = DEFAULT_PERSONALITIES.fighter;
      expect(fighter.aggressiveness).toBeGreaterThan(0.8);
      expect(fighter.caution).toBeLessThan(0.2);
      expect(fighter.intentReevaluationRate).toBeLessThan(1);

      // Carriers should be cautious and group-oriented
      const carrier = DEFAULT_PERSONALITIES.carrier;
      expect(carrier.aggressiveness).toBeLessThan(0.4);
      expect(carrier.caution).toBeGreaterThan(0.6);
      expect(carrier.groupCohesion).toBeGreaterThan(0.8);
      expect(carrier.intentReevaluationRate).toBeGreaterThan(2);
    });

    test('should have progressive intent reevaluation rates', () => {
      const shipClasses: ShipClass[] = ['fighter', 'corvette', 'frigate', 'destroyer', 'carrier'];
      const personalities = shipClasses.map(cls => DEFAULT_PERSONALITIES[cls]);

      // Larger ships should reevaluate less frequently
      for (let i = 1; i < personalities.length; i++) {
        expect(personalities[i].intentReevaluationRate).toBeGreaterThanOrEqual(personalities[i - 1].intentReevaluationRate);
      }
    });
  });

  describe('Turret AI Configuration', () => {
    test('should have valid turret config structure', () => {
      validateConfigStructure(DEFAULT_TURRET_CONFIG, [
        'behavior', 'targetReevaluationRate', 'maxTargetSwitchAngle',
        'leadPredictionTime', 'minimumFireRange', 'maximumFireRange'
      ]);

      expect(DEFAULT_TURRET_CONFIG.targetReevaluationRate).toBeGreaterThan(0);
      expect(DEFAULT_TURRET_CONFIG.maxTargetSwitchAngle).toBeGreaterThan(0);
      expect(DEFAULT_TURRET_CONFIG.leadPredictionTime).toBeGreaterThanOrEqual(0);
      expect(DEFAULT_TURRET_CONFIG.minimumFireRange).toBeGreaterThanOrEqual(0);
      expect(DEFAULT_TURRET_CONFIG.maximumFireRange).toBeGreaterThan(DEFAULT_TURRET_CONFIG.minimumFireRange);
    });

    test('should have reasonable turret AI settings', () => {
      expect(DEFAULT_TURRET_CONFIG.behavior).toBe('independent');
      expect(DEFAULT_TURRET_CONFIG.targetReevaluationRate).toBeLessThan(1); // Fast reevaluation
      expect(DEFAULT_TURRET_CONFIG.maxTargetSwitchAngle).toBeLessThan(Math.PI); // Less than 180 degrees
      expect(DEFAULT_TURRET_CONFIG.leadPredictionTime).toBeGreaterThan(0);
      expect(DEFAULT_TURRET_CONFIG.maximumFireRange).toBeGreaterThan(100); // Reasonable range
    });
  });

  describe('Roaming Patterns', () => {
    test('should have valid roaming patterns', () => {
      DEFAULT_ROAMING_PATTERNS.forEach(pattern => {
        validateConfigStructure(pattern, ['type', 'radius', 'speed', 'duration']);

        expect(['random', 'circular', 'figure_eight', 'waypoint']).toContain(pattern.type);
        expect(pattern.radius).toBeGreaterThan(0);
        expect(pattern.speed).toBeGreaterThan(0);
        expect(pattern.duration).toBeGreaterThan(0);
      });
    });

    test('should have variety in roaming patterns', () => {
      const types = DEFAULT_ROAMING_PATTERNS.map(p => p.type);
      expect(new Set(types).size).toBeGreaterThan(1); // At least 2 different types
    });
  });

  describe('Formation Configurations', () => {
    test('should have valid formation configs', () => {
      Object.values(DEFAULT_FORMATIONS).forEach(formation => {
        validateConfigStructure(formation, [
          'type', 'spacing', 'leaderId', 'maxSize', 'cohesionStrength'
        ]);

        expect(['line', 'circle', 'wedge', 'column', 'sphere']).toContain(formation.type);
        expect(formation.spacing).toBeGreaterThan(0);
        expect(formation.maxSize).toBeGreaterThan(0);
        expect(formation.cohesionStrength).toBeGreaterThan(0);
        expect(formation.cohesionStrength).toBeLessThanOrEqual(1);
      });
    });

    test('should have different formation types', () => {
      const types = Object.values(DEFAULT_FORMATIONS).map(f => f.type);
      expect(new Set(types).size).toBeGreaterThan(1);
    });

    test('formations should have reasonable spacing', () => {
      Object.values(DEFAULT_FORMATIONS).forEach(formation => {
        expect(formation.spacing).toBeGreaterThan(50); // Minimum reasonable spacing
        expect(formation.spacing).toBeLessThan(200); // Maximum reasonable spacing
      });
    });
  });

  describe('Default Behavior Config', () => {
    test('should have valid overall structure', () => {
      validateConfigStructure(DEFAULT_BEHAVIOR_CONFIG, [
        'defaultPersonality', 'shipPersonalities', 'teamModifiers',
        'turretConfig', 'roamingPatterns', 'formations', 'globalSettings'
      ]);
    });

    test('should have all ship classes in personalities', () => {
      const expectedClasses: ShipClass[] = ['fighter', 'corvette', 'frigate', 'destroyer', 'carrier'];
      expectedClasses.forEach(shipClass => {
        expect(DEFAULT_BEHAVIOR_CONFIG.shipPersonalities).toHaveProperty(shipClass);
      });
    });

    test('should have team modifiers for both teams', () => {
      const teams: Team[] = ['red', 'blue'];
      teams.forEach(team => {
        expect(DEFAULT_BEHAVIOR_CONFIG.teamModifiers).toHaveProperty(team);
      });
    });

    test('global settings should be reasonable', () => {
      const settings = DEFAULT_BEHAVIOR_CONFIG.globalSettings;
      expect(settings.aiEnabled).toBe(true);
      expect(settings.maxFormationSize).toBeGreaterThan(0);
      expect(settings.minimumSafeDistance).toBeGreaterThan(0);
      expect(settings.formationSearchRadius).toBeGreaterThan(settings.minimumSafeDistance);
      expect(typeof settings.enableDynamicBehavior).toBe('boolean');
    });

    test('should have damage-based evade settings', () => {
      const settings = DEFAULT_BEHAVIOR_CONFIG.globalSettings;
      expect(settings).toHaveProperty('evadeOnlyOnDamage');
      expect(settings).toHaveProperty('evadeRecentDamageWindowSeconds');
      expect(settings).toHaveProperty('damageEvadeThreshold');
      expect(settings).toHaveProperty('damageDecayRate');
      
      expect(typeof settings.evadeOnlyOnDamage).toBe('boolean');
      expect(settings.evadeRecentDamageWindowSeconds).toBeGreaterThan(0);
      expect(settings.damageEvadeThreshold).toBeGreaterThan(0);
      expect(settings.damageDecayRate).toBeGreaterThan(0);
    });
  });

  describe('Configuration Functions', () => {
    describe('getEffectivePersonality', () => {
    test('should return base personality when no team modifier', () => {
      const config = { ...DEFAULT_BEHAVIOR_CONFIG };
      config.teamModifiers = {}; // Remove all team modifiers

      const basePersonality = DEFAULT_PERSONALITIES.fighter;
      const effective = getEffectivePersonality(config, 'fighter', 'red');

      // Should be different object but same values (allow for floating point precision)
      expect(effective).not.toBe(basePersonality);
      expect(effective.mode).toBe(basePersonality.mode);
      expect(effective.intentReevaluationRate).toBe(basePersonality.intentReevaluationRate);
      expect(effective.minIntentDuration).toBe(basePersonality.minIntentDuration);
      expect(effective.maxIntentDuration).toBe(basePersonality.maxIntentDuration);
      expect(effective.aggressiveness).toBeCloseTo(basePersonality.aggressiveness, 10);
      expect(effective.caution).toBeCloseTo(basePersonality.caution, 10);
      expect(effective.groupCohesion).toBeCloseTo(basePersonality.groupCohesion, 10);
      expect(effective.preferredRangeMultiplier).toBeCloseTo(basePersonality.preferredRangeMultiplier, 10);
    });      test('should apply team modifiers correctly', () => {
        const config = { ...DEFAULT_BEHAVIOR_CONFIG };
        config.teamModifiers = {
          red: { aggressiveness: 1.5, caution: 0.5, groupCohesion: 1.0 }
        };

        const basePersonality = DEFAULT_PERSONALITIES.fighter;
        const effective = getEffectivePersonality(config, 'fighter', 'red');

        // Fighter base aggressiveness is 0.9, multiplied by 1.5 = 1.35, clamped to 1.0
        expect(effective.aggressiveness).toBeCloseTo(1.0, 5);
        expect(effective.caution).toBeCloseTo(basePersonality.caution * 0.5, 5);
        expect(effective.groupCohesion).toBe(basePersonality.groupCohesion); // No modifier
      });

      test('should clamp values between 0 and 1', () => {
        const config = { ...DEFAULT_BEHAVIOR_CONFIG };
        config.teamModifiers = {
          red: { aggressiveness: 10, caution: -5, groupCohesion: 1.0 }
        };

        const effective = getEffectivePersonality(config, 'fighter', 'red');

        expect(effective.aggressiveness).toBe(1); // Clamped to max
        expect(effective.caution).toBe(0); // Clamped to min
      });
    });

    describe('selectRoamingPattern', () => {
      test('should return a valid roaming pattern', () => {
        const pattern = selectRoamingPattern(DEFAULT_BEHAVIOR_CONFIG);

        expect(DEFAULT_ROAMING_PATTERNS).toContain(pattern);
        validateConfigStructure(pattern, ['type', 'radius', 'speed', 'duration']);
      });
    });

    describe('getFormationConfig', () => {
      test('should return correct formation config', () => {
        const lineFormation = getFormationConfig(DEFAULT_BEHAVIOR_CONFIG, 'line');
        expect(lineFormation).toBeDefined();
        expect(lineFormation!.type).toBe('line');

        const unknownFormation = getFormationConfig(DEFAULT_BEHAVIOR_CONFIG, 'unknown');
        expect(unknownFormation).toBeUndefined();
      });
    });
  });

  describe('Configuration Balance Validation', () => {
    test('fighter should have highest maneuverability', () => {
      const fighter = DEFAULT_PERSONALITIES.fighter;
      const otherClasses: ShipClass[] = ['corvette', 'frigate', 'destroyer', 'carrier'];

      otherClasses.forEach(shipClass => {
        const personality = DEFAULT_PERSONALITIES[shipClass];
        expect(fighter.intentReevaluationRate).toBeLessThanOrEqual(personality.intentReevaluationRate);
      });
    });

    test('carrier should have lowest aggressiveness', () => {
      const carrier = DEFAULT_PERSONALITIES.carrier;
      const otherClasses: ShipClass[] = ['fighter', 'corvette', 'frigate', 'destroyer'];

      otherClasses.forEach(shipClass => {
        const personality = DEFAULT_PERSONALITIES[shipClass];
        expect(carrier.aggressiveness).toBeLessThanOrEqual(personality.aggressiveness);
      });
    });

    test('larger ships should have higher group cohesion', () => {
      const shipClasses: ShipClass[] = ['fighter', 'corvette', 'frigate', 'destroyer', 'carrier'];
      const personalities = shipClasses.map(cls => DEFAULT_PERSONALITIES[cls]);

      for (let i = 1; i < personalities.length; i++) {
        expect(personalities[i].groupCohesion).toBeGreaterThanOrEqual(personalities[i - 1].groupCohesion);
      }
    });

    test('formations should have appropriate cohesion for their type', () => {
      const escortFormation = DEFAULT_FORMATIONS.escort;
      const lineFormation = DEFAULT_FORMATIONS.line;

      // Escort formation should have higher cohesion than line formation
      expect(escortFormation.cohesionStrength).toBeGreaterThan(lineFormation.cohesionStrength);
    });
  });
});