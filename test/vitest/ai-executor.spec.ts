import { describe, expect, it } from 'vitest';
import { Quaternion, Vector3 } from 'three';
import { resolveBehaviorProfile } from '../../src/game/aiProfiles.js';
import { __aiTestHooks } from '../../src/game/systems.js';
import type { AIState, GameState, ShipEntity } from '../../src/types/index.js';

const { writeCommand } = __aiTestHooks;

function createState(): GameState {
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
      metrics: {
        totalDecisions: 0,
        totalSkipped: 0,
        budgetHits: 0,
        lastDecisions: 0,
        lastSkipped: 0,
        lastSliceSize: 0,
        lastTotalShips: 0,
      },
    },
    blackboard: {
      tickIndex: 0,
      teamPosture: { blue: 'hold', red: 'hold' },
      allyCentroid: { blue: new Vector3(), red: new Vector3() },
      nearestEnemy: new Map(),
      threatToVip: new Map(),
      tmpVectors: [],
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
  } as unknown as GameState;
}

function createShip(id: number, team: 'blue' | 'red', position: Vector3): ShipEntity {
  const heading = new Vector3(0, 0, 1);
  const ai: AIState = {
    profileId: 'brawler',
    intent: 'Attack',
    nextThinkAt: 0,
    cooldowns: { dodgeAt: 0, burstAt: 0 },
    lod: 0,
    traitSeed: 1234,
    traits: { aggression: 1, patience: 1, dodge: 1 },
    command: {
      heading,
      thrust: 0,
      firePrimary: false,
      ttl: 0,
    },
  };

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
      hull: 'fighter',
      hp: 80,
      maxHp: 80,
      shield: 0,
      maxShield: 0,
      shieldRegen: 0,
      cooldown: 0,
      fireRate: 1,
      damage: 6,
      projectileSpeed: 30,
      range: 260,
      speed: 40,
      bulletType: 'bullet:laser',
    },
    model: 'fighter',
    ai,
  } as ShipEntity;
}

describe('writeCommand executors', () => {
  it('keeps brawler ships inside band and fires when on target', () => {
    const state = createState();
    const ship = createShip(1, 'blue', new Vector3());
    const target = createShip(2, 'red', new Vector3(170, 0, 0));
    const profile = resolveBehaviorProfile('brawler');

    ship.ai!.intent = 'Attack';
    ship.ai!.command.heading.set(0, 0, 0);
    writeCommand(state, ship, ship.ai!, profile, target, null);

    expect(ship.ai!.command.thrust).toBeCloseTo(0.35, 2);
    expect(ship.ai!.command.firePrimary).toBe(true);
    expect(ship.ai!.command.heading.x).toBeCloseTo(1, 2);
    expect(ship.ai!.command.heading.z).toBeCloseTo(0, 2);
    expect(ship.ai!.command.targetId).toBe(target.id);
  });

  it('backs off when target breaches desired minimum', () => {
    const state = createState();
    const ship = createShip(3, 'blue', new Vector3());
    const target = createShip(4, 'red', new Vector3(60, 0, 0));
    const profile = resolveBehaviorProfile('brawler');

    ship.ai!.intent = 'Attack';
    writeCommand(state, ship, ship.ai!, profile, target, null);

    expect(ship.ai!.command.thrust).toBeCloseTo(0.6, 2);
    expect(ship.ai!.command.heading.x).toBeCloseTo(-1, 2);
    expect(ship.ai!.command.firePrimary).toBe(true);
  });

  it('steers away while kiting and keeps weapons hot', () => {
    const state = createState();
    const ship = createShip(5, 'red', new Vector3());
    ship.ai!.profileId = 'kiter';
    const target = createShip(6, 'blue', new Vector3(180, 0, 0));
    const profile = resolveBehaviorProfile('kiter');

    ship.ai!.intent = 'Kite';
    writeCommand(state, ship, ship.ai!, profile, target, null);

    expect(ship.ai!.command.heading.x).toBeCloseTo(-1, 2);
    expect(ship.ai!.command.thrust).toBe(1);
    expect(ship.ai!.command.firePrimary).toBe(true);
  });

  it('pulls toward VIPs when escorting and disables primary fire', () => {
    const state = createState();
    const ship = createShip(7, 'blue', new Vector3());
    ship.ai!.profileId = 'escort';
    const vip = createShip(8, 'blue', new Vector3(0, 0, 120));
    const profile = resolveBehaviorProfile('escort');

    ship.ai!.intent = 'Escort';
    writeCommand(state, ship, ship.ai!, profile, null, vip);

    expect(ship.ai!.command.heading.z).toBeCloseTo(1, 2);
    expect(ship.ai!.command.thrust).toBeCloseTo(0.8, 2);
    expect(ship.ai!.command.firePrimary).toBe(false);
    expect(ship.ai!.command.targetId).toBe(vip.id);
  });
});
