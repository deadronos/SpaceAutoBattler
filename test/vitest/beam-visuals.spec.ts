import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { createGameState, disposeGameState } from '../../src/game/state.js';
import { spawnShip } from '../../src/game/ships.js';
import { fireProjectile } from '../../src/game/systems/projectiles.js';
import { flushPostPhysicsMutations } from '../../src/game/simulationQueue.js';
import type { BeamVisualEntity, GameState, ShipEntity } from '../../src/types/index.js';

async function setupState(): Promise<{
  state: GameState;
  shooter: ShipEntity;
  target: ShipEntity;
}> {
  const state = await createGameState();
  const shooter = spawnShip(state, {
    hull: 'fighter',
    team: 'blue',
    position: new Vector3(0, 0, 0),
    heading: 0,
  });
  const target = spawnShip(state, {
    hull: 'fighter',
    team: 'red',
    position: new Vector3(0, 0, 200),
    heading: Math.PI,
  });
  return { state, shooter, target };
}

describe('beam visuals', () => {
  it('extend visuals to the actual engagement distance', async () => {
    const { state, shooter, target } = await setupState();
    try {
      const direction = target.transform.position
        .clone()
        .sub(shooter.transform.position)
        .normalize();

      fireProjectile(state, shooter, direction, {
        targetId: target.id,
        projectileCategory: 'beam',
      });

      flushPostPhysicsMutations(state);

      const visuals = state.queries.beamVisuals.entities as BeamVisualEntity[];
      expect(visuals).toHaveLength(1);

      const beam = visuals[0];

      const muzzleOffset = shooter.transform.scale * 1.6;
      const expectedLength =
        target.transform.position.clone().sub(shooter.transform.position).length() - muzzleOffset;

      expect(beam.beamVisual.length).toBeGreaterThan(60);
      expect(beam.beamVisual.length).toBeCloseTo(expectedLength, 3);
      expect(beam.beamVisual.maxLength).toBeGreaterThanOrEqual(shooter.ship.range);
    } finally {
      disposeGameState(state);
    }
  });
});
