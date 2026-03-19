import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { Quaternion, Vector3 } from 'three';
import { createTestGameState, createTestShip } from '../../helpers/fixtures.js';
import type { GameState, ShipEntity } from '../../../../src/types/index.js';
import { flushDeferredMutations } from '../../../../src/game/simulationQueue.js';
import {
  executeShipAi,
  type ShipDecision,
} from '../../../../src/game/systems/shipControl/aiExecutor.js';
import { applyShipMovement } from '../../../../src/game/systems/shipControl/movementApply.js';
import { handleShipWeapons } from '../../../../src/game/systems/shipControl/weapons.js';

vi.mock('../../../../src/game/systems/projectiles.js', () => ({
  fireProjectile: vi.fn(),
}));

const { fireProjectile } = await import('../../../../src/game/systems/projectiles.js');
const fireProjectileMock = fireProjectile as unknown as ReturnType<typeof vi.fn>;

function setupShip(): { ship: ShipEntity; state: GameState } {
  const ship = createTestShip(1, 'blue', new Vector3());
  ship.ship.motion = {
    maxTurnRate: Math.PI / 2,
    angularAcceleration: Math.PI,
    angularDamping: 0.1,
    angularSettlingRate: 0.1,
    angularSettleToleranceDeg: 5,
    turnKp: 4,
    turnKd: 0.6,
    linearAcceleration: 20,
    linearDamping: 0.2,
    maxSpeed: 40,
    maxReverseSpeed: 10,
    smoothing: { rotationSlerp: 0 },
  } as ShipEntity['ship']['motion'];
  ship.transform.rotation = new Quaternion();
  ship.ship.velocity = new Vector3();
  ship.ship.angularVelocity = new Vector3();
  const state = createTestGameState();
  state.queries.ships.entities.push(ship);
  state.shipById.set(ship.id, ship);
  ship.rigidBody = {
    setNextKinematicTranslation: vi.fn(),
  } as never;
  return { ship, state };
}

describe('shipControl module refactor', () => {
  beforeEach(() => {
    fireProjectileMock.mockClear();
  });

  it('computes ship decisions and selects preferred targets', () => {
    const { ship, state } = setupShip();
    const enemy = createTestShip(2, 'red', new Vector3(0, 0, 50));
    state.queries.ships.entities.push(enemy);
    state.shipById.set(enemy.id, enemy);
    ship.ai!.command.heading = new Vector3(1, 0, 0);
    ship.ai!.command.thrust = 0.5;
    ship.ai!.command.firePrimary = true;
    ship.ai!.targetId = enemy.id;

    const result = executeShipAi(state, ship, 0.1);
    expect(result.decision).not.toBeNull();
    expect(result.preferredTarget?.id).toBe(enemy.id);
    expect(result.decision!.heading.length()).toBeCloseTo(1, 3);
    expect(result.decision!.thrust).toBeGreaterThan(0);
  });

  it('resolves preferred target from shipById even when query list is stale', () => {
    const { ship, state } = setupShip();
    const enemy = createTestShip(3, 'red', new Vector3(0, 0, 60));
    state.shipById.set(enemy.id, enemy);
    ship.ai!.targetId = enemy.id;

    const result = executeShipAi(state, ship, 0.1);

    expect(result.preferredTarget?.id).toBe(enemy.id);
  });

  it('ignores query-only targets missing from shipById', () => {
    const { ship, state } = setupShip();
    const enemy = createTestShip(4, 'red', new Vector3(0, 0, 60));
    state.queries.ships.entities.push(enemy);
    ship.ai!.targetId = enemy.id;

    const result = executeShipAi(state, ship, 0.1);

    expect(result.preferredTarget).toBeNull();
  });

  it('keeps ships stationary when movement thrust is zero', () => {
    const { ship, state } = setupShip();
    const decision: ShipDecision = {
      heading: new Vector3(0, 0, 1),
      thrust: 0,
      firePrimary: false,
    };

    applyShipMovement(state, ship, decision, 0.1);
    flushDeferredMutations(state);

    expect((ship.rigidBody as any).setNextKinematicTranslation).toHaveBeenCalledWith({
      x: ship.transform.position.x,
      y: ship.transform.position.y,
      z: ship.transform.position.z,
    });
  });

  it('fires weapons and records cooldowns when decision requests primary fire', () => {
    const { ship, state } = setupShip();
    ship.ship.cooldown = 0;
    const decision: ShipDecision = {
      heading: new Vector3(0, 0, 1),
      thrust: 0,
      firePrimary: true,
    };

    handleShipWeapons(state, ship, decision, null);

    expect(fireProjectile).toHaveBeenCalled();
    expect(ship.ship.cooldown).toBe(ship.ship.fireRate);
    expect(ship.muzzleFlashes?.length ?? 0).toBe(1);
  });
});
