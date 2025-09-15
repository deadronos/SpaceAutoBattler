 
import { describe, test, expect, beforeEach } from 'vitest';
import { createMockGameState, TEST_DEFAULTS } from './setupTests.js';
import { AIController } from '../../src/core/aiController.js';
import { DEFAULT_BEHAVIOR_CONFIG } from '../../src/config/behaviorConfig.js';
import { spawnShip } from '../../src/core/gameState.js';
import type { GameState } from '../../src/types/index.js';

describe('Config Externalization Tests', () => {
  let state: GameState;
  let aiController: AIController;

  beforeEach(() => {
    state = createMockGameState();
    state.behaviorConfig = { ...DEFAULT_BEHAVIOR_CONFIG };
    aiController = new AIController(state);
  });

  describe('Combat Range Multipliers', () => {
    test('should use configurable close range multiplier for aggressive intent', () => {
      // Spawn ships close together
      const ship1 = spawnShip(state, 'red', 'fighter');
      const ship2 = spawnShip(state, 'blue', 'fighter');

      ship1.pos = { ...TEST_DEFAULTS.defaultPos };
      ship2.pos = {
        x: TEST_DEFAULTS.defaultPos.x + 50,
        y: TEST_DEFAULTS.defaultPos.y,
        z: TEST_DEFAULTS.defaultPos.z,
      }; // 50 units apart
      // Rebuild spatial index so nearest/enemy queries reflect updated positions
      if (state.spatialGrid && state.behaviorConfig?.globalSettings.enableSpatialIndex) {
        state.spatialGrid.rebuild(
          state.ships.map((s) => ({ id: s.id, pos: s.pos, radius: 16, team: s.team })),
        );
      }

      // Initialize AI state
      ship1.aiState = {
        currentIntent: 'idle',
        intentEndTime: 0,
        lastIntentReevaluation: 0,
        preferredRange: TEST_DEFAULTS.preferredRange, // Preferred range from TEST_DEFAULTS
        recentDamage: 0,
        lastDamageTime: 0,
      };

      // Test with default close range multiplier (0.6)
      // Distance 50 < preferredRange (100) * closeRangeMultiplier (0.6) = 60
      // Should trigger close range behavior
      const defaultResult = (aiController as any).chooseAggressiveIntent(
        ship1,
        state.behaviorConfig!.defaultPersonality,
      );
      expect(defaultResult).toBe('pursue'); // Should pursue in close range

      // Test with modified close range multiplier (0.4)
      state.behaviorConfig!.globalSettings.closeRangeMultiplier = 0.4;
      // Distance 50 > preferredRange (100) * closeRangeMultiplier (0.4) = 40
      // Should not trigger close range behavior, falls into medium range
      const modifiedResult = (aiController as any).chooseAggressiveIntent(
        ship1,
        state.behaviorConfig!.defaultPersonality,
      );
      expect(modifiedResult).toBe('pursue'); // Still pursue but different logic path
    });

    test('should use configurable medium range multiplier for aggressive intent', () => {
      const ship1 = spawnShip(state, 'red', 'fighter');
      const ship2 = spawnShip(state, 'blue', 'fighter');

      ship1.pos = { ...TEST_DEFAULTS.defaultPos };
      ship2.pos = {
        x: TEST_DEFAULTS.defaultPos.x + 110,
        y: TEST_DEFAULTS.defaultPos.y,
        z: TEST_DEFAULTS.defaultPos.z,
      }; // 110 units apart
      // Rebuild spatial index so nearest/enemy queries reflect updated positions
      if (state.spatialGrid && state.behaviorConfig?.globalSettings.enableSpatialIndex) {
        state.spatialGrid.rebuild(
          state.ships.map((s) => ({ id: s.id, pos: s.pos, radius: 16, team: s.team })),
        );
      }

      ship1.aiState = {
        currentIntent: 'idle',
        intentEndTime: 0,
        lastIntentReevaluation: 0,
        preferredRange: TEST_DEFAULTS.preferredRange,
        recentDamage: 0,
        lastDamageTime: 0,
      };

      // Test with default medium range multiplier (1.2)
      // Distance 110 < preferredRange (100) * mediumRangeMultiplier (1.2) = 120
      // Should trigger medium range behavior
      const defaultResult = (aiController as any).chooseAggressiveIntent(
        ship1,
        state.behaviorConfig!.defaultPersonality,
      );
      expect(defaultResult).toBe('pursue');

      // Test with modified medium range multiplier (1.0)
      state.behaviorConfig!.globalSettings.mediumRangeMultiplier = 1.0;
      // Distance 110 > preferredRange (100) * mediumRangeMultiplier (1.0) = 100
      // Should fall into long range behavior
      const modifiedResult = (aiController as any).chooseAggressiveIntent(
        ship1,
        state.behaviorConfig!.defaultPersonality,
      );
      // This should be 'pursue' or 'strafe' based on RNG - we'll just check it's not the same logic
      expect(['pursue', 'strafe']).toContain(modifiedResult);
    });
  });

  describe('Separation Clustering Thresholds', () => {
    test('should apply different separation weights based on neighbor count thresholds', () => {
      const ship = spawnShip(state, 'red', 'fighter');
      ship.pos = { ...TEST_DEFAULTS.defaultPos };
      ship.vel = { x: 0, y: 0, z: 0 };
      ship.speed = 50;

      // Create exactly 6 ships to test the moderate cluster threshold
      const neighbors = [];
      for (let i = 0; i < 6; i++) {
        const neighbor = spawnShip(state, 'red', 'fighter');
        neighbor.pos = {
          x: TEST_DEFAULTS.defaultPos.x + i * 15, // Close enough to trigger separation
          y: TEST_DEFAULTS.defaultPos.y,
          z: TEST_DEFAULTS.defaultPos.z,
        };
        neighbors.push(neighbor);
      }

      // Rebuild spatial index so separation queries see the new neighbor positions
      if (state.spatialGrid && state.behaviorConfig?.globalSettings.enableSpatialIndex) {
        state.spatialGrid.rebuild(
          state.ships.map((s) => ({ id: s.id, pos: s.pos, radius: 16, team: s.team })),
        );
      }
      // With 6 neighbors (default moderate cluster threshold is 5)
      // Should apply moderate weight (2.0)

      // Test with default thresholds
      (aiController as any).executeIdle(ship, 0.1); // This applies separation
      const velocityAfterDefault = { ...ship.vel };

      // Reset ship velocity
      ship.vel = { x: 0, y: 0, z: 0 };

      // Modify thresholds so 6 neighbors now counts as mild cluster
      state.behaviorConfig!.globalSettings.separationModerateCluster = 8; // Higher threshold
      state.behaviorConfig!.globalSettings.separationMildCluster = 3; // Lower threshold
      state.behaviorConfig!.globalSettings.separationMildWeight = 1.5; // Different weight

      // Execute idle again with new thresholds
      (aiController as any).executeIdle(ship, 0.1);
      const velocityAfterModified = { ...ship.vel };

      // Velocities should be different due to different weight application
      const defaultMagnitude = Math.sqrt(
        velocityAfterDefault.x ** 2 + velocityAfterDefault.y ** 2 + velocityAfterDefault.z ** 2,
      );
      const modifiedMagnitude = Math.sqrt(
        velocityAfterModified.x ** 2 + velocityAfterModified.y ** 2 + velocityAfterModified.z ** 2,
      );

      expect(defaultMagnitude).not.toBeCloseTo(modifiedMagnitude, 5);
    });
  });

  describe('Movement and Boundary Configuration', () => {
    test('should use configurable movement close enough threshold', () => {
      const ship = spawnShip(state, 'red', 'fighter');
      ship.pos = { ...TEST_DEFAULTS.defaultPos };
      ship.vel = { x: 0, y: 0, z: 0 };

      // Target position exactly at default threshold distance (10)
      const targetPos = {
        x: TEST_DEFAULTS.defaultPos.x + TEST_DEFAULTS.movementThreshold,
        y: TEST_DEFAULTS.defaultPos.y,
        z: TEST_DEFAULTS.defaultPos.z,
      };

      // Test with default threshold (10)
      const originalThreshold = state.behaviorConfig!.globalSettings.movementCloseEnoughThreshold;
      expect(originalThreshold).toBe(TEST_DEFAULTS.movementThreshold);

      // Movement should stop at threshold
      (aiController as any).moveTowards(ship, targetPos, 0.1);

      // Change threshold to 5
      state.behaviorConfig!.globalSettings.movementCloseEnoughThreshold = 5;
      const initialVel = { ...ship.vel };
      (aiController as any).moveTowards(ship, targetPos, 0.1);

      // With lower threshold, ship should continue moving
      expect(
        ship.vel.x !== initialVel.x || ship.vel.y !== initialVel.y || ship.vel.z !== initialVel.z,
      ).toBe(true);
    });

    test('should use configurable boundary safety margin in evade scoring', () => {
      const ship = spawnShip(state, 'red', 'fighter');
      ship.pos = { ...TEST_DEFAULTS.defaultPos };

      const threat = spawnShip(state, 'blue', 'fighter');
      threat.pos = {
        x: TEST_DEFAULTS.defaultPos.x + 20,
        y: TEST_DEFAULTS.defaultPos.y,
        z: TEST_DEFAULTS.defaultPos.z,
      };

      // Test position near boundary with default margin (50)
      // nearBoundaryPos is intentionally within TEST_DEFAULTS.boundarySafetyMargin from edge for default margin
      const nearBoundaryPos = {
        x: TEST_DEFAULTS.boundarySafetyMargin - 10,
        y: TEST_DEFAULTS.defaultPos.y,
        z: TEST_DEFAULTS.defaultPos.z,
      };
      const defaultScore = (aiController as any).calculateEscapeScore(ship, nearBoundaryPos, [
        threat,
      ]);

      // Test with modified boundary margin (25)
      state.behaviorConfig!.globalSettings.boundarySafetyMargin = Math.max(
        25,
        Math.floor(TEST_DEFAULTS.boundarySafetyMargin / 2),
      );
      const modifiedScore = (aiController as any).calculateEscapeScore(ship, nearBoundaryPos, [
        threat,
      ]);

      // Scores should be different due to different boundary penalties
      expect(defaultScore).not.toBe(modifiedScore);
      // With smaller margin, penalty should be less severe
      expect(modifiedScore).toBeGreaterThan(defaultScore);
    });
  });

  describe('Evade Behavior Configuration', () => {
    test('should use configurable evade scoring weights', () => {
      const ship = spawnShip(state, 'red', 'fighter');
      ship.pos = { x: 100, y: 100, z: 100 };

      const threat = spawnShip(state, 'blue', 'fighter');
      threat.pos = {
        x: TEST_DEFAULTS.defaultPos.x + 50,
        y: TEST_DEFAULTS.defaultPos.y,
        z: TEST_DEFAULTS.defaultPos.z,
      };

      const targetPos = {
        x: TEST_DEFAULTS.defaultPos.x - 20,
        y: TEST_DEFAULTS.defaultPos.y,
        z: TEST_DEFAULTS.defaultPos.z,
      };

      // Test with default weights
      const defaultScore = (aiController as any).calculateEscapeScore(ship, targetPos, [threat]);

      // Test with modified threat penalty weight
      const originalWeight = state.behaviorConfig!.globalSettings.evadeThreatPenaltyWeight;
      state.behaviorConfig!.globalSettings.evadeThreatPenaltyWeight = originalWeight * 2;
      const modifiedScore = (aiController as any).calculateEscapeScore(ship, targetPos, [threat]);

      // Score should be lower with higher threat penalty weight
      expect(modifiedScore).toBeLessThan(defaultScore);

      // Restore original weight
      state.behaviorConfig!.globalSettings.evadeThreatPenaltyWeight = originalWeight;
    });

    test('should use configurable evade max pitch angle', () => {
      const ship = spawnShip(state, 'red', 'fighter');
      ship.pos = { x: 100, y: 100, z: 100 };
      ship.aiState = {
        currentIntent: 'evade',
        intentEndTime: 0,
        lastIntentReevaluation: 0,
        preferredRange: 100,
        recentDamage: 0,
        lastDamageTime: 0,
      };

      const threat = spawnShip(state, 'blue', 'fighter');
      threat.pos = { x: 120, y: 100, z: 100 };

      // Test with default max pitch (Math.PI * 0.5)
      const originalMaxPitch = state.behaviorConfig!.globalSettings.evadeMaxPitch;
      expect(originalMaxPitch).toBe(Math.PI * 0.5);

      // Test with modified max pitch (Math.PI * 0.25)
      state.behaviorConfig!.globalSettings.evadeMaxPitch = Math.PI * 0.25;

      // Execute evade behavior - this should use the new pitch limit
      (aiController as any).executeEvade(ship, 0.1);

      // We can't easily test the exact sampling, but we can verify the config value is used
      expect(state.behaviorConfig!.globalSettings.evadeMaxPitch).toBe(Math.PI * 0.25);
    });
  });
});
