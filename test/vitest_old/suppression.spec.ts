import { describe, it, expect } from 'vitest';
import { createInitialState, spawnShip, simulateStep } from '../../src/core/gameState.js';
import type { TurretState } from '../../src/types/index.js';

describe('area suppression behavior', () => {
  it('fires multiple bullets when turret behavior is area_suppression', () => {
    const state = createInitialState('test-seed-suppression');
    // Spawn shooter at origin and target ahead
    const shooter = spawnShip(state, 'red', 'fighter', { x: 0, y: 0, z: 0 });
    const target = spawnShip(state, 'blue', 'fighter', { x: 100, y: 0, z: 0 });
    // Ensure no bullets initially
    expect(state.bullets.length).toBe(0);

    // Configure first turret for suppression
    const t = shooter.turrets[0];
    t.aiState = {
      targetId: target.id,
      lastTargetUpdate: state.time,
      behavior: 'area_suppression',
      suppressionCount: 4,
      suppressionAngle: Math.PI / 16,
    } as TurretState['aiState'];
    shooter.targetId = target.id;

    // Simulate one step - turrets should fire
    simulateStep(state, 1 / 60);

    // Expect multiple bullets created by the shooter turret
    const byShooter = state.bullets.filter((b) => b.ownerShipId === shooter.id);
    expect(byShooter.length).toBeGreaterThanOrEqual(2);
  });
});
