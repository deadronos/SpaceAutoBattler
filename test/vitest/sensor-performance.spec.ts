import { describe, expect, it } from 'vite-plus/test';
import { Vector3, Quaternion } from 'three';
import { updateSensorSystem, ensureSensorState } from '../../src/game/systems/sensors.js';
import { createDefaultDoctrineState } from '../../src/game/aiDoctrine.js';
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
    shipById: new Map(),
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
      profileSubsystems: false,
      profileSampleRate: 1,
      enableSubsystemGuards: true,
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
      subsystemTimings: {
        durations: {},
        lastTickIndex: -1,
        lastTickTime: 0,
      },
    },
    uiFlags: { hudHealthBars: false },
    explosions: [],
    explosionPool: [],
    progressionEvents: new Map(),
  } as GameState;
}

function createShip(id: number, team: 'blue' | 'red', position: Vector3): ShipEntity {
  return {
    id,
    rigidBody: {} as never,
    collider: {} as never,
    transform: {
      position: position.clone(),
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

describe('Sensor performance', () => {
  it('handles moderate fleet sizes efficiently', () => {
    const state = createState();
    ensureSensorState(state);

    // Create 50 ships (25 per team) distributed in space
    const ships: ShipEntity[] = [];
    for (let i = 0; i < 25; i++) {
      const angle = (i / 25) * Math.PI * 2;
      const radius = 500;
      const bluePos = new Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
      const redPos = new Vector3(
        Math.cos(angle + Math.PI) * radius,
        0,
        Math.sin(angle + Math.PI) * radius,
      );

      ships.push(createShip(i * 2, 'blue', bluePos));
      ships.push(createShip(i * 2 + 1, 'red', redPos));
    }

    const startTime = performance.now();
    updateSensorSystem(state, ships);
    const duration = performance.now() - startTime;

    // Performance threshold with headroom for CI variability
    // Should complete in reasonable time (< 30ms for 50 ships)
    expect(duration).toBeLessThan(30);

    // Verify some ships detected enemies
    expect(state.blackboard.visibleEnemies!.blue.size).toBeGreaterThan(0);
    expect(state.blackboard.visibleEnemies!.red.size).toBeGreaterThan(0);
  });

  it('handles large fleet sizes with spatial optimization', () => {
    const state = createState();
    ensureSensorState(state);

    // Create 100 ships (50 per team) to test scaling
    const ships: ShipEntity[] = [];
    for (let i = 0; i < 50; i++) {
      const angle = (i / 50) * Math.PI * 2;
      const radius = 600 + (i % 5) * 100; // Vary radius for depth
      const y = (i % 3) * 50; // Add vertical variation

      const bluePos = new Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
      const redPos = new Vector3(
        Math.cos(angle + Math.PI) * radius,
        -y,
        Math.sin(angle + Math.PI) * radius,
      );

      ships.push(createShip(i * 2, 'blue', bluePos));
      ships.push(createShip(i * 2 + 1, 'red', redPos));
    }

    const startTime = performance.now();
    updateSensorSystem(state, ships);
    const duration = performance.now() - startTime;

    // Performance threshold with headroom for CI variability
    // Should scale reasonably with spatial grid optimization (< 100ms for 100 ships)
    // Without optimization, O(N^3) would take much longer
    expect(duration).toBeLessThan(100);

    // Verify functionality still works
    expect(state.blackboard.visibleEnemies!.blue.size).toBeGreaterThan(0);
    expect(state.blackboard.visibleEnemies!.red.size).toBeGreaterThan(0);
  });

  it('handles dense fleet formations without severe regression', () => {
    const state = createState();
    ensureSensorState(state);

    const ships: ShipEntity[] = [];
    for (let i = 0; i < 100; i++) {
      const x = (i % 10) * 10;
      const z = Math.floor(i / 10) * 10;

      const bluePos = new Vector3(x, 0, z);
      const redPos = new Vector3(x + 5, 0, z + 5);

      const blueShip = createShip(i * 2, 'blue', bluePos);
      const redShip = createShip(i * 2 + 1, 'red', redPos);
      blueShip.ship.sensor = {
        detectionRange: 1200,
        trackingRange: 1500,
        coneAngle: Math.PI * 0.95,
        falloff: 0.8,
      };
      redShip.ship.sensor = {
        detectionRange: 1200,
        trackingRange: 1500,
        coneAngle: Math.PI * 0.95,
        falloff: 0.8,
      };

      ships.push(blueShip, redShip);
    }

    // Warm up once to avoid first-run JIT noise.
    updateSensorSystem(state, ships);

    const samples: number[] = [];
    for (let i = 0; i < 5; i++) {
      state.ai.tickIndex = i;
      const startTime = performance.now();
      updateSensorSystem(state, ships);
      samples.push(performance.now() - startTime);
    }

    samples.sort((a, b) => a - b);
    const median = samples[Math.floor(samples.length / 2)];

    expect(median).toBeLessThan(40);
    expect(state.blackboard.visibleEnemies!.blue.size).toBeGreaterThan(0);
    expect(state.blackboard.visibleEnemies!.red.size).toBeGreaterThan(0);
  });

  it('maintains functional equivalence with occlusion', () => {
    const state = createState();
    ensureSensorState(state);

    // Set up scenario with occlusion: source -> blocker -> target in a line
    const source = createShip(1, 'blue', new Vector3(0, 0, 0));
    const blocker = createShip(2, 'blue', new Vector3(0, 0, 200));
    const target = createShip(3, 'red', new Vector3(0, 0, 400));

    // Make source face the target (identity quaternion faces +Z)
    source.transform.rotation.set(0, 0, 0, 1);

    blocker.ship.sensor!.detectionRange = 0;
    blocker.ship.sensor!.trackingRange = 0;

    updateSensorSystem(state, [source, blocker, target]);

    const visibility = state.blackboard.visibleEnemies!.blue.get(target.id);

    // Should detect target and mark as occluded
    expect(visibility).toBeDefined();
    expect(visibility?.occluded).toBe(true);
  });
});
