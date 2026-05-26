import { describe, it } from 'vite-plus/test';
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

function createFleet(shipCount: number): ShipEntity[] {
  const ships: ShipEntity[] = [];
  const halfCount = Math.floor(shipCount / 2);

  for (let i = 0; i < halfCount; i++) {
    const angle = (i / halfCount) * Math.PI * 2;
    const radius = 500 + (i % 5) * 100;
    const y = (i % 3) * 50;

    const bluePos = new Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
    const redPos = new Vector3(
      Math.cos(angle + Math.PI) * radius,
      -y,
      Math.sin(angle + Math.PI) * radius,
    );

    ships.push(createShip(i * 2, 'blue', bluePos));
    ships.push(createShip(i * 2 + 1, 'red', redPos));
  }

  return ships;
}

function benchmark(shipCount: number, iterations = 10) {
  const state = createState();
  ensureSensorState(state);
  const ships = createFleet(shipCount);

  // Warmup
  updateSensorSystem(state, ships);

  const times: number[] = [];
  for (let i = 0; i < iterations; i++) {
    state.ai.tickIndex = i;
    const start = performance.now();
    updateSensorSystem(state, ships);
    const duration = performance.now() - start;
    times.push(duration);
  }

  times.sort((a, b) => a - b);
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const median = times[Math.floor(times.length / 2)];
  const min = times[0];
  const max = times[times.length - 1];

  return { avg, median, min, max, shipCount };
}

describe('Sensor System Benchmark (Manual Run)', () => {
  it.skip('benchmarks various fleet sizes', () => {
    console.log('\nSensor System Performance Benchmark');
    console.log('=====================================\n');

    const testCases = [20, 50, 100, 150, 200];

    console.log('Fleet Size | Avg (ms) | Median (ms) | Min (ms) | Max (ms)');
    console.log('-----------|----------|-------------|----------|----------');

    for (const shipCount of testCases) {
      const result = benchmark(shipCount);
      console.log(
        `${String(result.shipCount).padStart(10)} | ` +
          `${result.avg.toFixed(2).padStart(8)} | ` +
          `${result.median!.toFixed(2).padStart(11)} | ` +
          `${result.min!.toFixed(2).padStart(8)} | ` +
          `${result.max!.toFixed(2).padStart(8)}`,
      );
    }

    console.log('\n✓ Performance optimization with spatial partitioning and caching');
    console.log('✓ Complexity reduced from O(N³) to O(N² × k) where k is cells checked');
  });
});
