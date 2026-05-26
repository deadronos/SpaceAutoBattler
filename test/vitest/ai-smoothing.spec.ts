import { describe, it, expect } from 'vite-plus/test';
import { Vector3 } from 'three';
import { resolveBehaviorProfile } from '../../src/game/aiProfiles.js';
import { __aiTestHooks } from '../../src/game/systems.js';
import { useUiStore } from '../../src/game/uiStore.js';
import { createDefaultMetrics } from '../../src/game/metrics.js';
import type { GameState, ShipEntity, AIState } from '../../src/types/index.js';

const { writeCommand } = __aiTestHooks;

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
    },
    blackboard: {
      tickIndex: 0,
      teamPosture: { blue: 'hold', red: 'hold' },
      allyCentroid: { blue: new Vector3(), red: new Vector3() },
      nearestEnemy: new Map(),
      threatToVip: new Map(),
      tmpVectors: [],
      strengthRatio: { blue: 1, red: 1 },
    },
    queries: { ships: { entities: [] }, projectiles: { entities: [] }, turrets: { entities: [] } },
    world: {} as never,
    physicsWorld: {} as never,
    eventQueue: {} as never,
    colliderLookup: new Map(),
    rapier: {} as never,
    nextEntityId: 1,
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
      },
    },
  } as unknown as GameState;
}

function createShip(id: number, profileId = 'brawler'): ShipEntity {
  const heading = new Vector3(0, 0, 1);
  const ai: AIState = {
    profileId,
    intent: 'Attack',
    nextThinkAt: 0,
    cooldowns: { dodgeAt: 0, burstAt: 0 },
    lod: 0,
    traitSeed: 1,
    traits: { aggression: 1, patience: 1, dodge: 1 },
    stickinessUntil: 0,
    stickinessHeading: new Vector3(0, 0, 1),
    command: { heading, thrust: 0, firePrimary: false, ttl: 0 },
  } as AIState;

  const ship = {
    id,
    transform: { position: new Vector3(), rotation: { x: 0, y: 0, z: 0, w: 1 }, scale: 1 },
    ship: {
      team: 'blue',
      hull: 'fighter',
      hp: 100,
      maxHp: 100,
      shield: 0,
      maxShield: 0,
      cooldown: 0,
      fireRate: 1,
      damage: 6,
      projectileSpeed: 30,
      range: 260,
      speed: 40,
      velocity: new Vector3(),
      angularVelocity: new Vector3(),
      lateralAcceleration: 0,
      motion: {} as any,
    },
    ai,
  } as unknown as ShipEntity;
  return ship;
}

function meanHeadingDelta(headings: Vector3[]): number {
  if (headings.length < 2) return 0;
  let sum = 0;
  for (let i = 1; i < headings.length; i++) {
    sum += headings[i]!.clone()
      .sub(headings[i - 1]!)
      .length();
  }
  return sum / (headings.length - 1);
}

describe('AI smoothing reduces heading jitter', () => {
  it('produces lower mean heading delta when smoothing is enabled', () => {
    const state = createState();
    const ship = createShip(1, 'brawler');
    const profile = resolveBehaviorProfile('brawler');
    const target = createShip(2, 'brawler');
    // Place the target further than the desiredRange so band stickiness won't
    // lock the heading and per-tick vertical perturbations are applied.
    target.transform.position.set(0, 0, 400);

    // Baseline with smoothing disabled via UI override
    const store = useUiStore.getState();
    const originalSmoothing = store.aiSmoothingEnabled;
    store.setAiSmoothingEnabled?.(false);

    const headingsOff: Vector3[] = [];
    for (let t = 0; t < 8; t++) {
      state.ai.tickIndex = t;
      writeCommand(state, ship, ship.ai!, profile, target, null, null);
      headingsOff.push(ship.ai!.command.heading.clone());
    }

    // Enable smoothing
    store.setAiSmoothingEnabled?.(true);

    const headingsOn: Vector3[] = [];
    for (let t = 10; t < 18; t++) {
      state.ai.tickIndex = t;
      writeCommand(state, ship, ship.ai!, profile, target, null, null);
      headingsOn.push(ship.ai!.command.heading.clone());
    }

    // Restore original
    store.setAiSmoothingEnabled?.(originalSmoothing ?? null);

    const offMean = meanHeadingDelta(headingsOff);
    const onMean = meanHeadingDelta(headingsOn);

    // Sanity checks: ensure test setup produced non-trivial headings so the
    // smoothing comparison is meaningful. If this fails, the test setup is
    // incorrect (e.g. degenerate positions) and should be updated rather than
    // silently passing/failing the smoothing assertion.
    expect(headingsOff.length).toBeGreaterThan(1);
    expect(offMean).toBeGreaterThan(0);

    // Expect smoothing to reduce mean heading delta
    expect(onMean).toBeLessThan(offMean);
  });
});
