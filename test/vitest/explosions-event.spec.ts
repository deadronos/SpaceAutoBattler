import { describe, it, expect, beforeEach } from 'vitest';
import { Quaternion, Vector3 } from 'three';
import type { GameState, ShipEntity, ProjectileEntity } from '../../src/types/index.js';
import { emitShipKillExplosion, updateExplosions, resetExplosionOverflowWarning } from '../../src/game/explosions.js';
import { getExplosionConfig, DEFAULT_EXPLOSION_CONFIG } from '../../src/config/explosions.js';
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
  it('creates deterministic explosion event with faction palette and timing', () => {
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
    
    // Test timing configuration
    expect(event.duration).toBe(config.timing.duration);
    expect(event.lightDuration).toBe(config.timing.lightDuration);
    expect(event.shockwave.delay).toBe(config.timing.shockwave.delay);
    expect(event.shockwave.duration).toBe(config.timing.shockwave.duration);
    expect(event.fireball.delay).toBe(config.timing.fireball.delay);
    expect(event.fireball.duration).toBe(config.timing.fireball.duration);
  });

  it('applies faction-specific timing differences', () => {
    const state = makeState(0.5);
    const allianceShip = makeShip('blue', 'destroyer', 1.0);
    const reaversShip = makeShip('red', 'destroyer', 1.0);

    const allianceEvent = emitShipKillExplosion(state, allianceShip);
    const reaversEvent = emitShipKillExplosion(state, reaversShip);

    // Reavers should generally have longer, more dramatic explosions
    expect(reaversEvent.duration).toBeGreaterThan(allianceEvent.duration);
    expect(reaversEvent.lightDuration).toBeGreaterThan(allianceEvent.lightDuration);
    
    // Colors should be faction-specific
    expect(allianceEvent.palette.flash).toContain('#a6d8ff'); // Alliance blue
    expect(reaversEvent.palette.flash).toContain('#ffb347'); // Reavers orange
  });

  it('scales timing appropriately by hull size', () => {
    const state = makeState(0.7);
    const fighter = makeShip('blue', 'fighter', 1.0);
    const carrier = makeShip('blue', 'carrier', 1.0);

    const fighterEvent = emitShipKillExplosion(state, fighter);
    const carrierEvent = emitShipKillExplosion(state, carrier);

    // Larger ships should have longer explosions
    expect(carrierEvent.duration).toBeGreaterThan(fighterEvent.duration);
    expect(carrierEvent.lightDuration).toBeGreaterThan(fighterEvent.lightDuration);
    expect(carrierEvent.shockwave.duration).toBeGreaterThan(fighterEvent.shockwave.duration);
    expect(carrierEvent.fireball.duration).toBeGreaterThan(fighterEvent.fireball.duration);
    
    // Debris speed should also scale
    expect(carrierEvent.debris.speed[0]).toBeGreaterThan(fighterEvent.debris.speed[0]);
    expect(carrierEvent.debris.speed[1]).toBeGreaterThan(fighterEvent.debris.speed[1]);
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

describe('explosion config parsing', () => {
  it('provides valid default config with timing', () => {
    expect(DEFAULT_EXPLOSION_CONFIG.timing.duration).toBeGreaterThan(0);
    expect(DEFAULT_EXPLOSION_CONFIG.timing.lightDuration).toBeGreaterThan(0);
    expect(DEFAULT_EXPLOSION_CONFIG.timing.shockwave.delay).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_EXPLOSION_CONFIG.timing.shockwave.duration).toBeGreaterThan(0);
    expect(DEFAULT_EXPLOSION_CONFIG.timing.fireball.delay).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_EXPLOSION_CONFIG.timing.fireball.duration).toBeGreaterThan(0);
    expect(DEFAULT_EXPLOSION_CONFIG.timing.debrisSpeed).toHaveLength(2);
    expect(DEFAULT_EXPLOSION_CONFIG.timing.debrisSpeed[1]).toBeGreaterThan(DEFAULT_EXPLOSION_CONFIG.timing.debrisSpeed[0]);
  });

  it('handles invalid faction gracefully with fallback', () => {
    // @ts-expect-error - testing invalid input
    const config = getExplosionConfig('invalid-faction', 'fighter');
    expect(config).toBe(DEFAULT_EXPLOSION_CONFIG);
    expect(config.timing.duration).toBe(DEFAULT_EXPLOSION_CONFIG.timing.duration);
  });

  it('handles invalid hull gracefully with fallback', () => {
    // @ts-expect-error - testing invalid input  
    const config = getExplosionConfig('alliance', 'invalid-hull');
    expect(config).toBe(DEFAULT_EXPLOSION_CONFIG);
    expect(config.timing.duration).toBe(DEFAULT_EXPLOSION_CONFIG.timing.duration);
  });
});

describe('deterministic behavior', () => {
  it('produces identical explosion timing with same seed', () => {
    const seed = 0.42;
    const state1 = makeState(seed);
    const state2 = makeState(seed);
    const ship1 = makeShip('blue', 'frigate', 1.5);
    const ship2 = makeShip('blue', 'frigate', 1.5);

    const event1 = emitShipKillExplosion(state1, ship1);
    const event2 = emitShipKillExplosion(state2, ship2);

    // All timing should be identical
    expect(event1.duration).toBe(event2.duration);
    expect(event1.lightDuration).toBe(event2.lightDuration);
    expect(event1.shockwave.delay).toBe(event2.shockwave.delay);
    expect(event1.shockwave.duration).toBe(event2.shockwave.duration);
    expect(event1.fireball.delay).toBe(event2.fireball.delay);
    expect(event1.fireball.duration).toBe(event2.fireball.duration);
    expect(event1.debris.speed).toEqual(event2.debris.speed);
    expect(event1.seed).toBe(event2.seed);
  });
});
