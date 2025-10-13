import { describe, expect, it } from 'vitest';
import { Vector3, Quaternion } from 'three';
import {
  applyDoctrineToProfile,
  activateDoctrine,
  updateDoctrineTimers,
  createDefaultDoctrineState,
} from '../../src/game/aiDoctrine.js';
import { assignTeamRoles, refreshBlackboard } from '../../src/game/systems/decision/blackboard.js';
import { createDefaultMetrics } from '../../src/game/metrics.js';
import type { BehaviorProfile, GameState, ShipEntity } from '../../src/types/index.js';

function createMockState(): GameState {
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

function createShip(
  id: number,
  team: 'blue' | 'red',
  hull: ShipEntity['ship']['hull'],
): ShipEntity {
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
      hull,
      hp: 100,
      maxHp: 100,
      shield: 0,
      maxShield: 0,
      shieldRegen: 0,
      cooldown: 0,
      fireRate: 1,
      damage: 10,
      projectileSpeed: 50,
      range: 200,
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

describe('Doctrine system', () => {
  it('modifies behavior profiles when doctrines are active', () => {
    const state = createMockState();
    const ship = createShip(1, 'blue', 'frigate');
    const baseProfile: BehaviorProfile = {
      desiredRange: [150, 250] as const,
      orbit: 50,
      aggression: 0.6,
      patience: 0.8,
      dodgeFreq: 0.2,
      classBias: {},
      style: 'kiter',
      verticalManeuver: 0.3,
    };

    const balanced = applyDoctrineToProfile(state, ship, baseProfile);
    expect(balanced.aggression).toBeCloseTo(baseProfile.aggression * 0.9, 5);
    expect(balanced.patience).toBeGreaterThan(baseProfile.patience);

    activateDoctrine(state, 'blue', 'aggressivePush');
    const aggressive = applyDoctrineToProfile(state, ship, baseProfile);
    expect(aggressive.aggression).toBeGreaterThan(baseProfile.aggression);
    expect(aggressive.desiredRange[0]).toBeLessThan(baseProfile.desiredRange[0]);
    expect(aggressive.bandPreference).toBe('inner');
  });

  it('expires temporary doctrine cards based on duration', () => {
    const state = createMockState();
    activateDoctrine(state, 'red', 'ambush', 2);
    expect(state.ai.doctrine?.teams.red.cardId).toBe('ambush');
    state.ai.tickIndex = 30; // exceeds 2 seconds at 0.1 interval
    updateDoctrineTimers(state);
    expect(state.ai.doctrine?.teams.red.cardId).toBe(state.ai.doctrine?.defaultCard);
  });

  it('applies escort reserve ratios from doctrines', () => {
    const state = createMockState();
    const vip = createShip(10, 'blue', 'destroyer');
    const escorts = [
      createShip(11, 'blue', 'fighter'),
      createShip(12, 'blue', 'fighter'),
      createShip(13, 'blue', 'fighter'),
    ];
    escorts.forEach((ship) => {
      ship.ai = {
        profileId: 'escort',
        intent: 'Escort',
        nextThinkAt: 0,
        cooldowns: { dodgeAt: 0, burstAt: 0 },
        lod: 1,
        traitSeed: 1,
        traits: { aggression: 0.5, patience: 0.5, dodge: 0.5 },
        command: { heading: new Vector3(), thrust: 0, firePrimary: false, ttl: 0 },
        stickinessUntil: 0,
        stickinessHeading: new Vector3(),
      } as never;
    });
    state.blackboard.threatToVip.set(vip.id, 99);
    const ships: ShipEntity[] = [vip, ...escorts];
    state.ai.assignments.escorts.clear();

    assignTeamRoles(state, ships);
    expect(state.ai.assignments.escorts.size).toBe(escorts.length);

    activateDoctrine(state, 'blue', 'aggressivePush');
    state.ai.assignments.escorts.clear();
    assignTeamRoles(state, ships);
    expect(state.ai.assignments.escorts.size).toBe(1);
  });

  it('overrides team posture when doctrine mandates it', () => {
    const state = createMockState();
    const blueShip = createShip(1, 'blue', 'frigate');
    const redShip = createShip(2, 'red', 'frigate');
    blueShip.transform.position.set(0, 0, 0);
    redShip.transform.position.set(0, 0, 200);
    state.blackboard.visibleEnemies!.blue.set(redShip.id, {
      strength: 1,
      lastSeenTick: 0,
      sourceId: blueShip.id,
      occluded: false,
      distance: 200,
    });
    state.blackboard.visibleEnemies!.red.set(blueShip.id, {
      strength: 1,
      lastSeenTick: 0,
      sourceId: redShip.id,
      occluded: false,
      distance: 200,
    });

    refreshBlackboard(state, [blueShip, redShip]);
    expect(state.blackboard.teamPosture.blue).toBe('hold');

    activateDoctrine(state, 'blue', 'aggressivePush');
    state.ai.tickIndex += 1;
    refreshBlackboard(state, [blueShip, redShip]);
    expect(state.blackboard.teamPosture.blue).toBe('aggressive');
  });
});
