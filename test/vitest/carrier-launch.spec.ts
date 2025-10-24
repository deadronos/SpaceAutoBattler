import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Quaternion, Vector3 } from 'three';

vi.mock('../../src/game/ships.js', () => ({
  spawnShip: vi.fn(),
}));

import { updateCarrierLaunchSystem } from '../../src/game/systems/carriers.js';
import { flushPostPhysicsMutations } from '../../src/game/simulationQueue.js';
import { spawnShip } from '../../src/game/ships.js';
import { CARRIER_LAUNCH_CONFIG } from '../../src/config/carriers.js';
import type {
  CarrierLaunchConfig,
  GameState,
  MotionStats,
  ShipBlueprint,
  ShipEntity,
} from '../../src/types/index.js';
import { SeededRng } from '../../src/utils/rng.js';
import { applyProgressionDefaults } from './helpers/progression.js';

const MOTION_STUB: MotionStats = {
  mass: 1,
  maxSpeed: 12,
  maxReverseSpeed: 4,
  linearAcceleration: 14,
  linearDamping: 2,
  maxTurnRate: Math.PI,
  angularAcceleration: Math.PI,
  angularDamping: 2,
  maxLateralAcceleration: 5,
};

const spawnShipMock = vi.mocked(spawnShip);
let nextEntityId = 1000;

beforeEach(() => {
  nextEntityId = 1000;
  spawnShipMock.mockReset();
  spawnShipMock.mockImplementation((state: GameState, blueprint: ShipBlueprint) => {
    const fighter = createFighterEntity(nextEntityId++, blueprint);
    const ships = state.queries.ships.entities as ShipEntity[];
    ships.push(fighter);
    return fighter;
  });
});

describe('carrier launch system', () => {
  it('spawns fighters until reaching the active cap and respects cooldowns', () => {
    const config = makeConfig({ cooldownSeconds: 0.25, maxActive: 4 });
    const carrier = createCarrierEntity(1, config);
    const ships: ShipEntity[] = [carrier];
    const state = createState(ships);

    updateCarrierLaunchSystem(state, 0);
    expect(spawnShipMock).not.toHaveBeenCalled();

    flushPostPhysicsMutations(state);
    expect(spawnShipMock).toHaveBeenCalledTimes(1);
    expect(carrier.carrier?.activeFighterIds.length).toBe(1);

    for (let i = 0; i < 10; i += 1) {
      updateCarrierLaunchSystem(state, config.cooldownSeconds);
      flushPostPhysicsMutations(state);
    }

    expect(carrier.carrier?.activeFighterIds.length).toBe(config.maxActive);
    expect(spawnShipMock).toHaveBeenCalledTimes(config.maxActive);
  });

  it('launches replacement fighters after tracked fighters are destroyed', () => {
    const config = makeConfig({ cooldownSeconds: 0.3 });
    const carrier = createCarrierEntity(2, config);
    const ships: ShipEntity[] = [carrier];
    const state = createState(ships);

    updateCarrierLaunchSystem(state, 0);
    flushPostPhysicsMutations(state);
    expect(carrier.carrier?.activeFighterIds.length).toBe(1);
    expect(spawnShipMock).toHaveBeenCalledTimes(1);

    ships.splice(1); // drop the spawned fighter from the live ship list

    updateCarrierLaunchSystem(state, config.cooldownSeconds);
    flushPostPhysicsMutations(state);

    expect(carrier.carrier?.activeFighterIds.length).toBe(1);
    expect(spawnShipMock).toHaveBeenCalledTimes(2);
  });

  it('ignores fighters that were not launched by the carrier', () => {
    const config = makeConfig({ cooldownSeconds: 0.2, maxActive: 2 });
    const carrier = createCarrierEntity(3, config);
    const otherCarrier = createCarrierEntity(4, config);
    const ships: ShipEntity[] = [carrier];
    const state = createState(ships);

    updateCarrierLaunchSystem(state, 0);
    flushPostPhysicsMutations(state);
    expect(spawnShipMock).toHaveBeenCalledTimes(1);

    const otherFighter = createFighterEntity(9000, {
      hull: 'fighter',
      team: otherCarrier.ship.team,
      position: new Vector3(),
      heading: 0,
      parentCarrierId: otherCarrier.id,
    });
    carrier.carrier?.activeFighterIds.push(otherFighter.id);
    ships.push(otherFighter);

    updateCarrierLaunchSystem(state, config.cooldownSeconds);
    flushPostPhysicsMutations(state);

    expect(spawnShipMock).toHaveBeenCalledTimes(2);
    expect(carrier.carrier?.activeFighterIds.length).toBe(2);
    const foreignIds =
      carrier.carrier?.activeFighterIds.filter((id) => id === otherFighter.id) ?? [];
    expect(foreignIds.length).toBe(0);
  });

  it('does not enqueue launches when the carrier is already at maxActive within the tick', () => {
    const config = makeConfig({ cooldownSeconds: 0, maxActive: 2 });
    const carrier = createCarrierEntity(5, config);
    const fighterA = createFighterEntity(6000, {
      hull: 'fighter',
      team: carrier.ship.team,
      position: new Vector3(),
      heading: 0,
      parentCarrierId: carrier.id,
    });
    const fighterB = createFighterEntity(6001, {
      hull: 'fighter',
      team: carrier.ship.team,
      position: new Vector3(),
      heading: 0,
      parentCarrierId: carrier.id,
    });
    carrier.carrier!.activeFighterIds.push(fighterA.id, fighterB.id);
    const ships: ShipEntity[] = [carrier, fighterA, fighterB];
    const state = createState(ships);

    updateCarrierLaunchSystem(state, 0);
    flushPostPhysicsMutations(state);

    expect(spawnShipMock).not.toHaveBeenCalled();
    expect(carrier.carrier?.activeFighterIds.length).toBe(config.maxActive);
  });

  it('queues launches for multiple carriers and flushes them deterministically', () => {
    const config = makeConfig({ cooldownSeconds: 0.1, maxActive: 3 });
    const carrierA = createCarrierEntity(6, config);
    const carrierB = createCarrierEntity(7, config);
    const ships: ShipEntity[] = [carrierA, carrierB];
    const state = createState(ships);

    updateCarrierLaunchSystem(state, 0);
    flushPostPhysicsMutations(state);

    expect(spawnShipMock).toHaveBeenCalledTimes(2);
    expect(carrierA.carrier?.activeFighterIds).toEqual([1000]);
    expect(carrierB.carrier?.activeFighterIds).toEqual([1001]);
  });
});

function makeConfig(overrides: Partial<CarrierLaunchConfig> = {}): CarrierLaunchConfig {
  return {
    maxActive: overrides.maxActive ?? CARRIER_LAUNCH_CONFIG.maxActive,
    cooldownSeconds: overrides.cooldownSeconds ?? CARRIER_LAUNCH_CONFIG.cooldownSeconds,
    batchSize: overrides.batchSize ?? CARRIER_LAUNCH_CONFIG.batchSize,
    formation: overrides.formation ?? Array.from(CARRIER_LAUNCH_CONFIG.formation),
    jitterRadius: overrides.jitterRadius ?? CARRIER_LAUNCH_CONFIG.jitterRadius,
  };
}

function createCarrierEntity(id: number, config: CarrierLaunchConfig): ShipEntity {
  const ship = {
    id,
    rigidBody: {} as any,
    collider: {} as any,
    transform: {
      position: new Vector3(0, 0, 0),
      rotation: new Quaternion(),
      scale: 1,
    },
    ship: {
      team: 'blue',
      hull: 'carrier',
      hp: 400,
      maxHp: 400,
      shield: 200,
      maxShield: 200,
      shieldRegen: 5,
      cooldown: 0,
      fireRate: 2,
      damage: 0,
      projectileSpeed: 0,
      range: 0,
      speed: 0,
      bulletType: undefined,
      velocity: new Vector3(),
      angularVelocity: new Vector3(0, 0, 0),
      lateralAcceleration: 0,
      motion: MOTION_STUB,
    },
    model: 'carrier',
    carrier: {
      launchCooldownRemaining: 0,
      activeFighterIds: [],
      launchIndex: 0,
      config,
    },
  } as unknown as ShipEntity;

  applyProgressionDefaults(ship.ship, { maxHpOverride: ship.ship.maxHp });
  return ship;
}

function createFighterEntity(id: number, blueprint: ShipBlueprint): ShipEntity {
  const ship = {
    id,
    rigidBody: {} as any,
    collider: {} as any,
    transform: {
      position: blueprint.position.clone(),
      rotation: new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), blueprint.heading),
      scale: 1,
    },
    ship: {
      team: blueprint.team,
      hull: 'fighter',
      hp: 40,
      maxHp: 40,
      shield: 12,
      maxShield: 12,
      shieldRegen: 1,
      cooldown: 0,
      fireRate: 1,
      damage: 4,
      projectileSpeed: 20,
      range: 120,
      speed: 18,
      bulletType: 'bullet:laser',
      parentCarrierId: blueprint.parentCarrierId,
      velocity: new Vector3(),
      angularVelocity: new Vector3(0, 0, 0),
      lateralAcceleration: 0,
      motion: MOTION_STUB,
    },
    model: 'fighter',
  } as unknown as ShipEntity;

  applyProgressionDefaults(ship.ship, { maxHpOverride: ship.ship.maxHp });
  return ship;
}

function createState(ships: ShipEntity[]): GameState {
  return {
    rng: new SeededRng(1234),
    queries: {
      ships: { entities: ships },
    },
    simulation: {
      step: 1 / 20,
      accumulator: 0,
      maxSubSteps: 5,
      alpha: 0,
      lastTickIndex: 0,
      lastTickStart: 0,
      lastTickDuration: 1 / 20,
      deferredMutations: [],
      postStepMutations: [],
      rapierDiagnostics: {
        deferredMutationFailures: 0,
        guardTrips: 0,
        lastFailureTick: -1,
        lastGuardTick: -1,
        lastDeferredMutationError: undefined,
      },
    },
  } as unknown as GameState;
}
