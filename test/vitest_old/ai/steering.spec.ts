import { describe, it, expect } from 'vitest';
import {
  calculateEscapeScore,
  calculateSeparationForceWithCount,
  moveTowards,
} from '../../../src/core/ai/steering.js';
import { DEFAULT_BEHAVIOR_CONFIG } from '../../../src/config/behaviorConfig.js';

describe('steering.calculateEscapeScore', () => {
  const settings = DEFAULT_BEHAVIOR_CONFIG.globalSettings;
  const bounds = { width: 1000, height: 1000, depth: 1000 };

  it('rewards moving farther from nearest threat and penalizes near boundary', () => {
    const shipPos = { x: 200, y: 200, z: 200 };
    const threat = { x: 250, y: 200, z: 200 };
    const targetSafer = { x: 400, y: 200, z: 200 };
    const targetWorse = { x: 220, y: 200, z: 200 };

    const sSafer = calculateEscapeScore(shipPos, targetSafer, [threat], [], bounds, settings);
    const sWorse = calculateEscapeScore(shipPos, targetWorse, [threat], [], bounds, settings);
    expect(sSafer).toBeGreaterThan(sWorse);

    // Boundary penalty check
    const nearBoundary = { x: 1, y: 1, z: 1 };
    const sBoundary = calculateEscapeScore(shipPos, nearBoundary, [threat], [], bounds, settings);
    expect(sBoundary).toBeLessThan(sSafer);
  });
});

describe('steering.calculateSeparationForceWithCount', () => {
  it('returns zero force when no neighbors', () => {
    const res = calculateSeparationForceWithCount(
      { x: 0, y: 0, z: 0 },
      [],
      100,
      0.0001,
      Math.random,
    );
    expect(res.neighborCount).toBe(0);
    expect(res.force).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('points away from nearby neighbor cluster', () => {
    const ship = { x: 0, y: 0, z: 0 };
    const neighbors = [
      { x: 10, y: 0, z: 0 },
      { x: 12, y: 0, z: 0 },
    ];
    const res = calculateSeparationForceWithCount(ship, neighbors, 100, 0.0001, Math.random);
    // Should generally push left (negative x)
    expect(res.neighborCount).toBe(2);
    expect(res.force.x).toBeLessThan(0);
  });
});

describe('steering.moveTowards', () => {
  it('turns and advances ship towards target under physics limits', () => {
    const settings = DEFAULT_BEHAVIOR_CONFIG.globalSettings;
    const ship = {
      id: 1,
      team: 'red',
      class: 'fighter',
      pos: { x: 0, y: 0, z: 0 },
      vel: { x: 0, y: 0, z: 0 },
      orientation: { pitch: 0, yaw: 0, roll: 0 },
      dir: 0,
      targetId: null,
      health: 100,
      maxHealth: 100,
      armor: 0,
      shield: 0,
      maxShield: 0,
      shieldRegen: 0,
      speed: 100,
      turnRate: 2,
      turrets: [],
      kills: 0,
      level: { level: 1, xp: 0, nextLevelXp: 10 },
    } as any;

    // Pick a target that requires a small yaw change from initial orientation (yaw=0)
    const target = { x: 100, y: 0, z: 50 };
    moveTowards(ship, target, 0.1, settings);
    // Should have moved a bit forward and adjusted orientation (either pitch or yaw)
    expect(ship.pos.x).toBeGreaterThan(0);
    const orientationDelta = Math.abs(ship.orientation.pitch) + Math.abs(ship.orientation.yaw);
    expect(orientationDelta).toBeGreaterThan(0);
  });
});
