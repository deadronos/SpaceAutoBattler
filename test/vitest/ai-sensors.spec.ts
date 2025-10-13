import { describe, expect, it } from 'vitest';
import { Vector3, Quaternion } from 'three';
import { updateSensorSystem, ensureSensorState } from '../../src/game/systems/sensors.js';
import { activateDoctrine, createDefaultDoctrineState } from '../../src/game/aiDoctrine.js';
import { createDefaultMetrics } from '../../src/game/metrics.js';
import type { GameState, ShipEntity } from '../../src/types/index.js';

function createState(): GameState {
  return {
    ai: {
      enabled: true,
      tickInterval: 0.1,
      maxPerTick: 30,
      accumulator: 0,
      tickIndex: 0,
      cursor: 0,
      slices: 1,
      assignments: { escorts: new Map() },
      metrics: createDefaultMetrics(),
      doctrine: createDefaultDoctrineState(),
    },
    blackboard: {
      tickIndex: 0,
      teamPosture: { blue: 'hold', red: 'hold' },
      allyCentroid: { blue: new Vector3(), red: new Vector3() },
      nearestEnemy: new Map(),
      threatToVip: new Map(),
      tmpVectors: [],
      strengthRatio: { blue: 1, red: 1 },
      teamPriority: { blue: [], red: [] },
      priorityIndex: { blue: new Map(), red: new Map() },
      focusFire: { blue: new Map(), red: new Map() },
      visibleEnemies: { blue: new Map(), red: new Map() },
      teamCounts: { blue: 0, red: 0 },
    },
    sensors: {
      lastUpdateTick: -1,
      visibilityByTeam: { blue: new Map(), red: new Map() },
      decayRate: 0.65,
      threshold: 0.18,
      staleDecay: 0.55,
    },
    queries: { ships: { entities: [] }, projectiles: { entities: [] }, turrets: { entities: [] } },
    world: {} as never,
    physicsWorld: {} as never,
    eventQueue: {} as never,
    colliderLookup: new Map(),
    rapier: {} as never,
    nextEntityId: 1,
    nextExplosionId: 1,
    time: 0,
    rng: {} as never,
    paused: false,
    timeScale: 1,
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
        stepPanics: 0,
        lastStepPanicTick: -1,
        lastStepPanicTime: 0,
        lastStepPanicDelta: 0,
        lastStepPanicMessage: undefined,
        lastStepPanicStack: undefined,
        lastStepPanicTimestamp: 0,
        subsystemFailures: 0,
        lastSubsystemFailureTick: -1,
        lastSubsystemFailureMessage: undefined,
        lastSubsystemFailureStack: undefined,
        lastSubsystemFailureTimestamp: 0,
      },
    },
    uiFlags: { hudHealthBars: false },
    explosions: [],
    explosionPool: [],
    progressionEvents: new Map(),
  } as GameState;
}

function createShip(id: number, team: 'blue' | 'red'): ShipEntity {
  return {
    id,
    rigidBody: {} as never,
    collider: {} as never,
    transform: {
      position: new Vector3(),
      rotation: new Quaternion(),
      scale: 1,
    },
    ship: {
      team,
      hull: 'frigate',
      hp: 100,
      maxHp: 100,
      shield: 0,
      maxShield: 0,
      shieldRegen: 0,
      cooldown: 0,
      fireRate: 1,
      damage: 10,
      projectileSpeed: 40,
      range: 220,
      speed: 20,
      bulletType: 'test',
      velocity: new Vector3(),
      angularVelocity: new Vector3(),
      lateralAcceleration: 0,
      motion: {
        mass: 1,
        maxSpeed: 20,
        linearAcceleration: 10,
        linearDamping: 1,
        maxTurnRate: Math.PI,
        angularAcceleration: Math.PI,
        angularDamping: 1,
      },
      sensor: { detectionRange: 600, trackingRange: 720, coneAngle: Math.PI * 0.8, falloff: 0.6 },
      stealth: 0,
      sensorSignature: 1,
      xp: 0,
      level: 1,
      xpToNext: 1,
      damageType: 'kinetic',
      levelBonuses: {} as never,
      subsystems: {} as never,
      armor: 0,
    },
  } as ShipEntity;
}

describe('Sensor system', () => {
  it('marks enemies visible when within range and facing', () => {
    const state = createState();
    ensureSensorState(state);
    const source = createShip(1, 'blue');
    const target = createShip(2, 'red');
    source.transform.rotation.set(0, 0, 0, 1);
    source.transform.position.set(0, 0, 0);
    target.transform.position.set(0, 0, 400);
    updateSensorSystem(state, [source, target]);
    expect(state.blackboard.visibleEnemies?.blue.has(target.id)).toBe(true);
  });

  it('applies doctrine stealth modifiers to reduce detection strength', () => {
    const state = createState();
    ensureSensorState(state);
    const source = createShip(3, 'blue');
    const target = createShip(4, 'red');
    source.transform.position.set(0, 0, 0);
    target.transform.position.set(0, 0, 650);
    target.ship.stealth = 0.4;
    updateSensorSystem(state, [source, target]);
    expect(state.blackboard.visibleEnemies?.blue.has(target.id)).toBe(true);

    const ambushState = createState();
    ensureSensorState(ambushState);
    const source2 = createShip(5, 'blue');
    const target2 = createShip(6, 'red');
    source2.transform.position.set(0, 0, 0);
    target2.transform.position.set(0, 0, 650);
    target2.ship.stealth = 0.4;
    activateDoctrine(ambushState, 'red', 'ambush');
    updateSensorSystem(ambushState, [source2, target2]);
    expect(ambushState.blackboard.visibleEnemies?.blue.has(target2.id)).toBe(false);
  });

  it('flags occlusion when another ship blocks the line of sight', () => {
    const state = createState();
    ensureSensorState(state);
    const source = createShip(7, 'blue');
    const blocker = createShip(8, 'blue');
    const target = createShip(9, 'red');
    source.transform.position.set(0, 0, 0);
    blocker.transform.position.set(0, 0, 200);
    blocker.ship.sensor.detectionRange = 0;
    blocker.ship.sensor.trackingRange = 0;
    target.transform.position.set(0, 0, 400);
    updateSensorSystem(state, [source, blocker, target]);
    const visibility = state.blackboard.visibleEnemies?.blue.get(target.id);
    expect(visibility?.occluded).toBe(true);
  });
});
