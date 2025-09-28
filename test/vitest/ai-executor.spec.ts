import { describe, expect, it } from 'vitest';
import { Quaternion, Vector3 } from 'three';
import { resolveBehaviorProfile } from '../../src/game/aiProfiles.js';
import { createDefaultMotionStats } from '../../src/game/ships.js';
import { __aiTestHooks } from '../../src/game/systems.js';
import { createDefaultMetrics } from '../../src/game/metrics.js';
import { AI_CONFIG } from '../../src/game/config.js';
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
      teamPriority: { blue: [], red: [] },
      priorityIndex: { blue: new Map(), red: new Map() },
      focusFire: { blue: new Map(), red: new Map() },
      verticalDispersion: {
        headingYSamples: [],
        positionYSamples: [],
        lastUpdateTick: -1,
      },
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
    },
  } as unknown as GameState;
}

function createShip(
  id: number,
  team: 'blue' | 'red',
  position: Vector3,
  velocity?: Vector3,
): ShipEntity {
  const vel = velocity ?? new Vector3();
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
    stickinessHeading: new Vector3(0, 0, 1),
    command: {
      heading,
      thrust: 0,
      firePrimary: false,
      ttl: 0,
    },
  };

  return {
    id,
    rigidBody: {
      setNextKinematicTranslation: () => undefined,
      setNextKinematicRotation: () => undefined,
      translation: () => ({ x: position.x, y: position.y, z: position.z }),
      rotation: () => ({ x: 0, y: 0, z: 0, w: 1 }),
      linvel: () => ({ x: vel.x, y: vel.y, z: vel.z }),
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
      fireRate: 1,
      damage: 6,
      projectileSpeed: 30,
      range: 260,
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

describe('writeCommand executors', () => {
  it('keeps brawler ships inside band and fires when on target', () => {
    const state = createState();
    const ship = createShip(1, 'blue', new Vector3());
    const target = createShip(2, 'red', new Vector3(170, 0, 0));
    const profile = resolveBehaviorProfile('brawler');

    ship.ai!.intent = 'Attack';
    ship.ai!.command.heading.set(0, 0, 0);
    writeCommand(state, ship, ship.ai!, profile, target, null, null);

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
    writeCommand(state, ship, ship.ai!, profile, target, null, null);

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
    writeCommand(state, ship, ship.ai!, profile, target, null, null);

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
    writeCommand(state, ship, ship.ai!, profile, null, vip, null);

    expect(ship.ai!.command.heading.z).toBeCloseTo(1, 2);
    expect(ship.ai!.command.thrust).toBeCloseTo(0.8, 2);
    expect(ship.ai!.command.firePrimary).toBe(false);
    expect(ship.ai!.command.targetId).toBe(vip.id);
  });

  it('computes lead heading for intercept intent', () => {
    const state = createState();
    const ship = createShip(9, 'blue', new Vector3());
    ship.ai!.profileId = 'escort';
    ship.ai!.intent = 'Intercept';
    ship.ship.projectileSpeed = 120;
    const movingTarget = createShip(10, 'red', new Vector3(0, 0, 240), new Vector3(60, 0, 0));
    const profile = resolveBehaviorProfile('escort');

    writeCommand(state, ship, ship.ai!, profile, movingTarget, null, null);

    expect(ship.ai!.command.thrust).toBeCloseTo(1, 2);
    const direct = new Vector3().copy(movingTarget.transform.position).sub(ship.transform.position).normalize();
    expect(ship.ai!.command.heading.x).toBeGreaterThan(direct.x);
    expect(ship.ai!.command.heading.z).toBeLessThan(direct.z);
    expect(ship.ai!.command.firePrimary).toBe(true);
    expect(ship.ai!.command.targetId).toBe(movingTarget.id);
  });

  it('backs away when repositioning inside desired band', () => {
    const state = createState();
    const ship = createShip(11, 'blue', new Vector3());
    ship.ai!.profileId = 'artillery';
    ship.ai!.intent = 'Reposition';
    const closeTarget = createShip(12, 'red', new Vector3(40, 0, 0));
    const profile = resolveBehaviorProfile('artillery');

    writeCommand(state, ship, ship.ai!, profile, closeTarget, null, null);

    expect(ship.ai!.command.heading.x).toBeLessThan(-0.5);
    expect(ship.ai!.command.thrust).toBeCloseTo(0.6, 1);
    expect(ship.ai!.command.firePrimary).toBe(false);
  });

  it('steers toward ally centroid and cuts fire when regrouping', () => {
    const state = createState();
    const ship = createShip(13, 'blue', new Vector3());
    ship.ai!.intent = 'Regroup';
    state.blackboard.allyCentroid.blue.set(300, 0, 0);
    state.blackboard.teamPosture.blue = 'retreat';
    const profile = resolveBehaviorProfile('brawler');

    writeCommand(state, ship, ship.ai!, profile, null, null, null);

    expect(ship.ai!.command.heading.x).toBeGreaterThan(0.5);
    expect(ship.ai!.command.thrust).toBeGreaterThan(0.75);
    expect(ship.ai!.command.firePrimary).toBe(false);
    expect(ship.ai!.command.targetId).toBeUndefined();
  });

  it('applies vertical perturbation for fighters during attack', () => {
    const state = createState();
    state.ai.tickIndex = 6;
    const fighter = createShip(30, 'blue', new Vector3());
    fighter.ai!.profileId = 'escort';
    fighter.ai!.intent = 'Attack';
    const profile = resolveBehaviorProfile('escort');
    const target = createShip(31, 'red', new Vector3(190, 0, 0));

    writeCommand(state, fighter, fighter.ai!, profile, target, null, null);

    expect(Math.abs(fighter.ai!.command.heading.y)).toBeGreaterThan(0.01);
  });

  it('applies role-specific vertical perturbation amplitudes', () => {
    const state = createState();
    state.ai.tickIndex = 10;
    
    // Test different profiles to ensure role-specific amplitudes
    const testCases = [
      { profileId: 'escort', expectedMin: 0.45, description: 'fighters (escort profile)' },
      { profileId: 'brawler', expectedMin: 0.2, description: 'corvettes (brawler profile)' },
      { profileId: 'artillery', expectedMin: 0.01, description: 'artillery (destroyer/carrier)' },
    ];

    for (const { profileId, expectedMin, description } of testCases) {
      const ship = createShip(Math.floor(Math.random() * 1000), 'blue', new Vector3());
      ship.ai!.profileId = profileId;
      ship.ai!.intent = 'Attack';
      const profile = resolveBehaviorProfile(profileId);
      const target = createShip(Math.floor(Math.random() * 1000), 'red', new Vector3(200, 50, 0));

      // Test multiple samples to account for RNG variation
      let maxPerturbation = 0;
      for (let i = 0; i < 10; i++) {
        state.ai.tickIndex = 10 + i;
        writeCommand(state, ship, ship.ai!, profile, target, null, null);
        maxPerturbation = Math.max(maxPerturbation, Math.abs(ship.ai!.command.heading.y));
      }

      expect(profile.verticalManeuver).toBeGreaterThanOrEqual(expectedMin);
      // Test that some vertical perturbation is applied
      expect(maxPerturbation).toBeGreaterThan(0); // ${description} should have some vertical perturbation
    }
  });

  it('does not apply vertical perturbation when verticalEnabled is false', () => {
    const state = createState();
    state.ai.tickIndex = 6;
    const fighter = createShip(30, 'blue', new Vector3());
    fighter.ai!.profileId = 'escort';
    fighter.ai!.intent = 'Attack';
    const profile = resolveBehaviorProfile('escort');
    const target = createShip(31, 'red', new Vector3(190, 0, 0));

    // Temporarily disable vertical perturbation
    const originalVerticalEnabled = AI_CONFIG.verticalEnabled;
    (AI_CONFIG as any).verticalEnabled = false;

    try {
      writeCommand(state, fighter, fighter.ai!, profile, target, null, null);
      
      // When disabled, heading.y should be close to 0 (no vertical perturbation)
      expect(Math.abs(fighter.ai!.command.heading.y)).toBeLessThan(0.001);
    } finally {
      // Restore original setting
      (AI_CONFIG as any).verticalEnabled = originalVerticalEnabled;
    }
  });

  it('records stickiness when maintaining preferred band', () => {
    const state = createState();
    state.ai.tickIndex = 10;
    const brawler = createShip(40, 'blue', new Vector3());
    brawler.ai!.profileId = 'brawler';
    brawler.ai!.intent = 'Attack';
    const profile = resolveBehaviorProfile('brawler');
    const target = createShip(41, 'red', new Vector3(180, 0, 0));

    writeCommand(state, brawler, brawler.ai!, profile, target, null, null);

    expect(brawler.ai!.stickinessUntil).toBeGreaterThan(state.ai.tickIndex);
    expect(brawler.ai!.stickinessTargetId).toBe(target.id);
    expect(brawler.ai!.stickinessHeading.length()).toBeGreaterThan(0);
  });
});

