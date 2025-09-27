import { describe, expect, it } from 'vitest';
import { Quaternion, Vector3 } from 'three';
import {
  createDefaultMetrics,
  recordShotMetrics,
  recordBandSample,
  recordIntentMetrics,
  aggregateKpis,
  resetMetrics,
} from '../../src/game/metrics.js';
import { __aiTestHooks } from '../../src/game/systems.js';
import { createDefaultMotionStats } from '../../src/game/ships.js';
import type { AIState, GameState, ShipEntity } from '../../src/types/index.js';

const { executeAICommand, runLegacyShipBehavior } = __aiTestHooks;

describe('AI metrics aggregation', () => {
  it('computes KPI summaries from recorded events', () => {
    const metrics = createDefaultMetrics();

    recordShotMetrics(metrics, {
      shipId: 1,
      hull: 'fighter',
      time: 10,
      distance: 240,
      deltaY: 150,
    });
    recordShotMetrics(metrics, {
      shipId: 2,
      hull: 'fighter',
      time: 18,
      distance: 280,
      deltaY: 40,
    });
    recordShotMetrics(metrics, {
      shipId: 3,
      hull: 'corvette',
      time: 32,
      distance: 300,
      deltaY: 130,
    });
    recordShotMetrics(metrics, {
      shipId: 4,
      hull: 'corvette',
      time: 35,
      distance: 180,
      deltaY: 20,
    });

    recordBandSample(metrics, 'fighter', true);
    recordBandSample(metrics, 'fighter', false);
    recordBandSample(metrics, 'corvette', true);
    recordBandSample(metrics, 'corvette', true);

    recordIntentMetrics(metrics, 1, 2, 'Attack', true);
    recordIntentMetrics(metrics, 1, 4, 'Intercept', true);
    recordIntentMetrics(metrics, 1, 6, 'Regroup', true);
    recordIntentMetrics(metrics, 1, 8, 'Kite', false);

    aggregateKpis(metrics, 60);

    const { kpis } = metrics;
    expect(kpis.firstShot.samples).toBe(4);
    expect(kpis.firstShot.p50).toBeCloseTo(18, 5);
    expect(kpis.firstShot.p90).toBeCloseTo(32, 5);

    expect(kpis.openingAggression.total).toBe(4);
    expect(kpis.openingAggression.aggressive).toBe(2);
    expect(kpis.openingAggression.ratio).toBeCloseTo(0.5, 5);

    expect(kpis.inBand.overall.samples).toBe(4);
    expect(kpis.inBand.overall.satisfied).toBe(3);
    expect(kpis.inBand.overall.ratio).toBeCloseTo(0.75, 5);
    expect(kpis.inBand.byHull.fighter.ratio).toBeCloseTo(0.5, 5);
    expect(kpis.inBand.byHull.corvette.ratio).toBe(1);

    expect(kpis.vertical.samples).toBe(4);
    expect(kpis.vertical.aboveThreshold).toBe(2);
    expect(kpis.vertical.ratio).toBeCloseTo(0.5, 5);

    resetMetrics(metrics);
    expect(metrics.firstShotTimes).toHaveLength(0);
    expect(metrics.intentTimeline).toHaveLength(0);
    expect(metrics.kpis.firstShot.samples).toBe(0);
    expect(metrics.kpis.openingAggression.total).toBe(0);
    expect(metrics.kpis.vertical.samples).toBe(0);
  });

  it('records shot telemetry via executeAICommand', () => {
    const state = createStubState();
    const shooter = createStubShip(1, 'blue', new Vector3(0, 0, 0));
    const target = createStubShip(2, 'red', new Vector3(200, 50, 0));
    shooter.ai!.command.firePrimary = true;
    shooter.ai!.command.heading.set(0, 0, 1);
    shooter.ai!.command.targetId = target.id;
    shooter.ai!.targetId = target.id;
    shooter.ship.cooldown = 0;

    const ships = state.queries.ships.entities as ShipEntity[];
    ships.push(shooter, target);

    const result = executeAICommand(state, shooter, 0.1);
    expect(result).toBe(target);

    const metrics = state.ai.metrics;
    expect(metrics.firstShotTimes).toHaveLength(1);
    expect(metrics.firstShotTimes[0]).toBeCloseTo(state.time, 5);
    expect(metrics.shotDistanceHist.fighter.total).toBe(1);
    expect(metrics.shotDeltaYHist.fighter.total).toBe(1);
  });

  it('records shot telemetry through legacy behavior', () => {
    const state = createStubState();
    state.ai.enabled = false;
    const ship = createStubShip(5, 'blue', new Vector3(0, 0, 0));
    const target = createStubShip(6, 'red', new Vector3(100, -120, 0));
    ship.ship.cooldown = 0;

    const ships = state.queries.ships.entities as ShipEntity[];
    ships.push(ship, target);

    const result = runLegacyShipBehavior(state, ship, 0.1);
    expect(result).toBe(target);

    const metrics = state.ai.metrics;
    expect(metrics.firstShotTimes).toHaveLength(1);
    expect(metrics.firstShotByShip[ship.id]).toBeCloseTo(state.time, 5);
    expect(metrics.shotDeltaYHist.fighter.total).toBeGreaterThan(0);
  });
});

function createStubState(): GameState {
  return {
    ai: {
      enabled: true,
      tickInterval: 0.1,
      maxPerTick: 20,
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
      tmpVectors: [new Vector3(), new Vector3(), new Vector3(), new Vector3()],
      strengthRatio: { blue: 1, red: 1 },
    },
    queries: { ships: { entities: [] }, projectiles: { entities: [] }, turrets: { entities: [] } },
    world: {} as never,
    physicsWorld: {} as never,
    eventQueue: {} as never,
    colliderLookup: new Map(),
    rapier: {} as never,
    nextEntityId: 1,
    time: 5,
    rng: {} as never,
    paused: false,
    timeScale: 1,
    uiFlags: { hudHealthBars: false },
    simulation: {
      step: 1 / 20,
      accumulator: 0,
      maxSubSteps: 5,
      alpha: 0,
      lastTickIndex: 0,
      lastTickStart: 0,
      lastTickDuration: 1 / 20,
    },
  } as unknown as GameState;
}

function createStubShip(id: number, team: 'blue' | 'red', position: Vector3): ShipEntity {
  const heading = new Vector3(0, 0, 1);
  const ai: AIState = {
    profileId: 'brawler',
    intent: 'Attack',
    nextThinkAt: 0,
    cooldowns: { dodgeAt: 0, burstAt: 0 },
    lod: 0,
    traitSeed: 1234,
    traits: { aggression: 1, patience: 1, dodge: 1 },
    stickinessUntil: 0,
    stickinessHeading: heading.clone(),
    command: {
      heading,
      thrust: 1,
      firePrimary: false,
      ttl: 0.1,
    },
  };

  return {
    id,
    rigidBody: {
      setNextKinematicTranslation: () => undefined,
      setNextKinematicRotation: () => undefined,
      translation: () => ({ x: position.x, y: position.y, z: position.z }),
      rotation: () => ({ x: 0, y: 0, z: 0, w: 1 }),
      linvel: () => ({ x: 0, y: 0, z: 0 }),
    } as never,
    collider: {} as never,
    transform: {
      position: position.clone(),
      rotation: new Quaternion(),
      scale: 1,
    },
    ship: {
      team,
      hull: 'fighter',
      hp: 80,
      maxHp: 80,
      shield: 0,
      maxShield: 0,
      shieldRegen: 0,
      cooldown: 0,
      fireRate: 0.5,
      damage: 6,
      projectileSpeed: 40,
      range: 280,
      speed: 40,
      bulletType: 'bullet:laser',
      velocity: new Vector3(0, 0, 0),
      angularVelocity: new Vector3(0, 0, 0),
      lateralAcceleration: 0,
      motion: createDefaultMotionStats(),
    },
    model: 'fighter',
    ai,
  } as ShipEntity;
}
