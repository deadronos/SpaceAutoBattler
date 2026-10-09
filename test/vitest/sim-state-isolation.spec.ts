import { describe, expect, it } from 'vite-plus/test';
import { Quaternion, Vector3 } from 'three';
import { updateSensorSystem } from '../../src/game/systems/sensors.js';
import { createTestGameState } from './helpers/fixtures.js';
import type { ShipEntity } from '../../src/types/index.js';

// Regression guard for per-GameState scratch: the sensor broadphase (and the
// projectile spatial hash/shipsById pair) used to live at module scope, so two
// states stepped in one process shared the same buffers. They are now keyed by
// GameState via WeakMap.

function makeShip(id: number, team: 'blue' | 'red', z: number): ShipEntity {
  return {
    id,
    rigidBody: {} as never,
    collider: {} as never,
    transform: {
      position: new Vector3(0, 0, z),
      rotation: new Quaternion(),
      scale: 1,
    },
    ship: {
      team,
      sensor: { detectionRange: 600, trackingRange: 720, coneAngle: Math.PI * 0.8, falloff: 0.6 },
      stealth: 0,
      sensorSignature: 1,
    },
  } as unknown as ShipEntity;
}

describe('simulation per-GameState isolation', () => {
  it('does not share sensor broadphase state across two GameStates', () => {
    const stateA = createTestGameState();
    const stateB = createTestGameState();

    const aSource = makeShip(1, 'blue', 0);
    const aTarget = makeShip(2, 'red', 400);
    const bSource = makeShip(1, 'blue', 0);

    // Interleave updates across two independent states.
    updateSensorSystem(stateA, [aSource, aTarget]);
    updateSensorSystem(stateB, [bSource]);

    expect(stateA.blackboard.visibleEnemies?.blue.has(aTarget.id)).toBe(true);
    expect(stateB.blackboard.visibleEnemies?.blue.size).toBe(0);

    // Rerunning A must still see its own target, unaffected by B.
    updateSensorSystem(stateB, [bSource]);
    updateSensorSystem(stateA, [aSource, aTarget]);

    expect(stateA.blackboard.visibleEnemies?.blue.has(aTarget.id)).toBe(true);
    expect(stateB.blackboard.visibleEnemies?.blue.size).toBe(0);
  });
});
