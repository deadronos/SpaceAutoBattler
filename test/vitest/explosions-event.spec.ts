import { describe, it, expect, beforeEach } from 'vitest';
import { Quaternion, Vector3 } from 'three';
import type { GameState, ShipEntity, ProjectileEntity } from '../../src/types/index.js';
import { emitShipKillExplosion, updateExplosions, resetExplosionOverflowWarning } from '../../src/game/explosions.js';
import { getExplosionConfig } from '../../src/config/explosions.js';
import { createDefaultMotionStats } from '../../src/game/ships.js';

function makeState(rngValue = 0.42): GameState {
  return {
    rapier: {} as any,
    physicsWorld: {} as any,
    eventQueue: {} as any,
    world: {
      entities: [],
      createEntity: (entity: any) => entity,
      destroyEntity: () => undefined,
    } as any,
    colliderLookup: new Map(),
    nextEntityId: 1,
    nextExplosionId: 1,
    time: 5,
    queries: {
      ships: { entities: [] },
      projectiles: { entities: [] },
      turrets: { entities: [] },
    } as any,
    rng: {
      next: () => rngValue,
    } as any,
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
    ai: undefined as any,
    blackboard: undefined as any,
    uiFlags: { hudHealthBars: false },
    explosions: [],
    explosionPool: [],
  } as GameState;
}

function makeShip(team: 'blue' | 'red', hull: ShipEntity['ship']['hull'], scale = 1.6): ShipEntity {
  return {
    id: 1,
    rigidBody: {} as any,
    collider: { handle: 1, isValid: () => true } as any,
    transform: { position: new Vector3(1, 2, 3), rotation: new Quaternion(), scale },
    ship: {
      team,
      hull,
      hp: 10,
      maxHp: 10,
      shield: 0,
      maxShield: 0,
      cooldown: 0,
      fireRate: 1,
      damage: 5,
      projectileSpeed: 10,
      range: 20,
      speed: 0,
      bulletType: 'bullet:laser',
      velocity: new Vector3(),
      angularVelocity: new Vector3(),
      lateralAcceleration: 0,
      motion: createDefaultMotionStats(),
    },
    direction: new Vector3(0, 0, 1),
  } as ShipEntity;
}

function makeProjectile(team: 'blue' | 'red'): ProjectileEntity {
  return {
    id: 99,
    rigidBody: {} as any,
    collider: { handle: 2, isValid: () => true } as any,
    transform: { position: new Vector3(), rotation: new Quaternion(), scale: 1 },
    projectile: {
      team,
      damage: 5,
      ttl: 1,
      maxTtl: 1,
      speed: 10,
      bulletType: 'bullet:rail',
    },
    direction: new Vector3(0, 0, 1),
  } as ProjectileEntity;
}

beforeEach(() => {
  resetExplosionOverflowWarning();
});

describe('emitShipKillExplosion', () => {
  it('creates deterministic explosion event with faction palette', () => {
    const state = makeState(0.123456789);
    const ship = makeShip('blue', 'frigate', 2.2);
    const projectile = makeProjectile('red');

    const event = emitShipKillExplosion(state, ship, projectile);
    expect(state.explosions.length).toBe(1);
    expect(event).toBe(state.explosions[0]);
    expect(event.id).toBe(1);
    expect(event.seed).toBe(Math.floor(0.123456789 * 1_000_000_000));
    expect(event.faction).toBe('alliance');
    expect(event.variant).toBe('bullet:rail');

    const config = getExplosionConfig('alliance', 'frigate');
    expect(event.radius).toBeCloseTo(config.baseRadius * ship.transform.scale, 5);
    expect(event.flashIntensity).toBeCloseTo(config.flashIntensity, 5);
    expect(event.particles.sparks).toBe(config.particleCounts.sparks);
    expect(event.palette.flash).toBe(config.palette.flash);
  });
});

describe('updateExplosions', () => {
  it('advances elapsed time and recycles expired events', () => {
    const state = makeState();
    const ship = makeShip('red', 'destroyer', 3);
    const projectile = makeProjectile('blue');
    const event = emitShipKillExplosion(state, ship, projectile);

    updateExplosions(state, 0.1);
    expect(event.elapsed).toBeCloseTo(0.1, 5);
    expect(event.lightElapsed).toBeCloseTo(0.1, 5);
    expect(state.explosions.length).toBe(1);

    updateExplosions(state, 2.0);
    expect(state.explosions.length).toBe(0);
    expect(state.explosionPool.length).toBe(1);
    expect(event.elapsed).toBe(0);
    expect(event.lightElapsed).toBe(0);
  });
});
