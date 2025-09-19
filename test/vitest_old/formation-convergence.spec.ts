import { describe, test, expect, beforeEach } from 'vitest';
import type { GameState, Ship, Vector3 } from '../../src/types/index.js';
import { AIController } from '../../src/core/aiController.js';
import { DEFAULT_BEHAVIOR_CONFIG } from '../../src/config/behaviorConfig.js';
import { createMockGameState, getTestDtFromState } from './setupTests.js';
import { spawnShip } from '../../src/core/gameState.js';
import { createRNG } from '../../src/utils/rng.js';

describe('Formation Convergence (regression guard)', () => {
  let gameState: GameState;
  let aiController: AIController;

  beforeEach(() => {
    gameState = createMockGameState();
    gameState.rng = createRNG('formation-test-seed');
    gameState.behaviorConfig = { ...DEFAULT_BEHAVIOR_CONFIG };
    gameState.ships = [];
    aiController = new AIController(gameState);
  });

  test('ships converge to assigned formation positions', () => {
    const formationCenter: Vector3 = { x: 400, y: 400, z: 250 };
    const spacing = 100;
    const ships: Ship[] = [];
    for (let i = 0; i < 5; i++) {
      const startPos: Vector3 = {
        x: formationCenter.x + (i - 2) * 20, // start somewhat close
        y: formationCenter.y,
        z: formationCenter.z,
      };
      const s = spawnShip(gameState, 'blue', 'frigate', startPos);
      if (s.aiState) {
        s.aiState.intentEndTime = gameState.time + 20;
        s.aiState.lastIntentReevaluation = gameState.time;
        s.aiState.formationPosition = {
          x: formationCenter.x + (i - 2) * spacing,
          y: formationCenter.y,
          z: formationCenter.z,
        };
        s.aiState.formationId = 'line';
      }
      ships.push(s);
    }

    // Simulate a short duration sufficient for convergence in normal config
    const dt = getTestDtFromState(gameState);
  const steps = Math.max(1, Math.floor(3 / dt));
    for (let i = 0; i < steps; i++) {
      aiController.updateAllShips(dt);
      gameState.time += dt;
      gameState.tick++;
      if (gameState.spatialGrid && gameState.behaviorConfig?.globalSettings.enableSpatialIndex) {
        gameState.spatialGrid.rebuild(
          gameState.ships.map((s) => ({ id: s.id, pos: s.pos, radius: 16, team: s.team })),
        );
      }
    }

    // Assert convergence
    for (const s of ships) {
      const expected = s.aiState?.formationPosition;
      if (!expected) continue;
      const dx = s.pos.x - expected.x;
      const dy = s.pos.y - expected.y;
      const dz = s.pos.z - expected.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      expect(dist).toBeLessThan(50);
    }
  });
});
