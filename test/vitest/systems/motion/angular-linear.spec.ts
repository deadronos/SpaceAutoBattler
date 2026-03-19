import { describe, it, expect, vi } from 'vite-plus/test';
import { Quaternion, Vector3 } from 'three';
import { updateAngularMotion } from '../../../../src/game/systems/motion/angular.js';
import { updateLinearMotion } from '../../../../src/game/systems/motion/linear.js';
import { applyVelocityToPhysics } from '../../../../src/game/systems/motion/physicsSync.js';
import { flushDeferredMutations } from '../../../../src/game/simulationQueue.js';
import { createDefaultMotionStats } from '../../../../src/game/ships.js';
import type { GameState, ShipEntity } from '../../../../src/types/index.js';
import { createTestGameState, createTestShip } from '../../helpers/fixtures.js';

function createMotionTestShip(): { ship: ShipEntity; state: GameState } {
  const ship = createTestShip(1, 'blue', new Vector3());
  const state = createTestGameState();
  state.queries.ships.entities.push(ship);

  ship.rigidBody = {
    setNextKinematicTranslation: vi.fn(),
    setNextKinematicRotation: vi.fn(),
  } as never;
  ship.transform.rotation = new Quaternion();
  ship.ship.velocity = new Vector3();
  ship.ship.angularVelocity = new Vector3();
  const motion = createDefaultMotionStats();
  ship.ship.motion = {
    ...motion,
    linearAcceleration: 20,
    maxSpeed: 50,
    angularAcceleration: 10,
    maxTurnRate: Math.PI,
    maxReverseSpeed: 10,
  } as ShipEntity['ship']['motion'];
  return { ship, state };
}

describe('motion module splits', () => {
  it('steers angular velocity toward the target heading', () => {
    const { ship } = createMotionTestShip();
    ship.transform.rotation.setFromAxisAngle(new Vector3(0, 1, 0), 0);
    ship.ship.angularVelocity.set(0, 0, 0);

    const targetHeading = new Vector3(1, 0, 0);
    updateAngularMotion(ship, targetHeading, 0.016);

    const forwardAfter = new Vector3(0, 0, 1).applyQuaternion(ship.transform.rotation);
    expect(forwardAfter.dot(targetHeading.normalize())).toBeGreaterThan(0);
    expect(ship.ship.angularVelocity.length()).toBeGreaterThan(0);
  });

  it('applies thrust and damping through updateLinearMotion', () => {
    const { ship } = createMotionTestShip();
    ship.ai!.command.thrust = 1;
    ship.ship.velocity.set(0, 0, 0);

    updateLinearMotion(ship, ship.ai!.command, 0.1);
    const speedAfterThrust = ship.ship.velocity.length();
    expect(speedAfterThrust).toBeGreaterThan(0);

    updateLinearMotion(ship, { ...ship.ai!.command, thrust: 0 }, 0.1);
    expect(ship.ship.velocity.length()).toBeLessThan(speedAfterThrust);
  });

  it('applies computed velocity to physics state', () => {
    const { ship, state } = createMotionTestShip();
    const startPosition = ship.transform.position.clone();
    ship.ship.velocity.set(0, 0, 10);

    applyVelocityToPhysics(state, ship, 0.1);
    flushDeferredMutations(state);

    expect((ship.rigidBody as any).setNextKinematicTranslation).toHaveBeenCalledTimes(1);
    const [{ x, y, z }] = (ship.rigidBody as any).setNextKinematicTranslation.mock.calls[0];
    expect(x).toBeCloseTo(startPosition.x);
    expect(y).toBeCloseTo(startPosition.y);
    expect(z).toBeCloseTo(startPosition.z + 1);
  });
});
