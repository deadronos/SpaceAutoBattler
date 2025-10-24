import { Vector3 } from 'three';
import type { ExplosionEvent, GameState, ProjectileEntity, ShipEntity } from '../types/index.js';
import { DEFAULT_EXPLOSION_CONFIG, getExplosionConfig } from '../config/explosions.js';

const MAX_EXPLOSIONS = 48;

let overflowWarned = false;

function obtainExplosion(state: GameState): ExplosionEvent {
  const pooled = state.explosionPool.pop();
  if (pooled) {
    return pooled;
  }
  const defaultTiming = DEFAULT_EXPLOSION_CONFIG.timing;
  return {
    id: 0,
    seed: 0,
    faction: 'alliance',
    hull: 'fighter',
    position: new Vector3(),
    radius: 0,
    startTime: 0,
    duration: defaultTiming.duration,
    lightDuration: defaultTiming.lightDuration,
    lightFalloff: DEFAULT_EXPLOSION_CONFIG.lightFalloff,
    lightColor: DEFAULT_EXPLOSION_CONFIG.lightColor,
    flashIntensity: DEFAULT_EXPLOSION_CONFIG.flashIntensity,
    shockwave: {
      delay: defaultTiming.shockwave.delay,
      duration: defaultTiming.shockwave.duration,
      maxRadius: 0,
    },
    fireball: {
      delay: defaultTiming.fireball.delay,
      duration: defaultTiming.fireball.duration,
    },
    debris: {
      count: DEFAULT_EXPLOSION_CONFIG.debrisCount,
      speed: [...defaultTiming.debrisSpeed] as [number, number],
    },
    particles: { ...DEFAULT_EXPLOSION_CONFIG.particleCounts },
    palette: { ...DEFAULT_EXPLOSION_CONFIG.palette },
    elapsed: 0,
    lightElapsed: 0,
  };
}

function recycleExplosion(state: GameState, event: ExplosionEvent): void {
  if (state.explosionPool.length >= MAX_EXPLOSIONS) return;
  event.elapsed = 0;
  event.lightElapsed = 0;
  event.variant = undefined;
  state.explosionPool.push(event);
}

function teamToFaction(team: ShipEntity['ship']['team']): 'alliance' | 'reavers' {
  return team === 'blue' ? 'alliance' : 'reavers';
}

export function emitShipKillExplosion(
  state: GameState,
  ship: ShipEntity,
  projectile?: ProjectileEntity,
): ExplosionEvent {
  const faction = teamToFaction(ship.ship.team);
  const config = getExplosionConfig(faction, ship.ship.hull);
  const event = obtainExplosion(state);

  if (state.explosions.length >= MAX_EXPLOSIONS) {
    let oldestIndex = 0;
    let oldestTime = state.explosions[0]?.startTime ?? Number.POSITIVE_INFINITY;
    for (let i = 1; i < state.explosions.length; i += 1) {
      const candidate = state.explosions[i];
      if (candidate.startTime < oldestTime) {
        oldestTime = candidate.startTime;
        oldestIndex = i;
      }
    }
    const [evicted] = state.explosions.splice(oldestIndex, 1);
    if (evicted) recycleExplosion(state, evicted);
    if (!overflowWarned) {
      overflowWarned = true;
      console.warn('[explosions] Explosion pool exhausted, evicting oldest event.');
    }
  }

  event.id = state.nextExplosionId++;
  const seedSample = state.rng.next();
  event.seed = Math.floor(seedSample * 1_000_000_000);
  event.faction = faction;
  event.hull = ship.ship.hull;
  event.position.copy(ship.transform.position);
  const radius = config.baseRadius * ship.transform.scale;
  event.radius = radius;
  event.startTime = state.time;
  event.duration = config.timing.duration;
  event.lightDuration = config.timing.lightDuration;
  event.lightFalloff = config.lightFalloff;
  event.lightColor = config.lightColor;
  event.flashIntensity = config.flashIntensity;
  event.shockwave.delay = config.timing.shockwave.delay;
  event.shockwave.duration = config.timing.shockwave.duration;
  const shockMulti = config.shockwaveMaxRadiusMulti ?? 1.8;
  event.shockwave.maxRadius = radius * shockMulti;
  event.fireball.delay = config.timing.fireball.delay;
  event.fireball.duration = config.timing.fireball.duration;
  event.debris.count = config.debrisCount;
  const debrisSpeedMin = config.timing.debrisSpeed[0] * (0.6 + ship.transform.scale * 0.4);
  const debrisSpeedMax = config.timing.debrisSpeed[1] * (0.7 + ship.transform.scale * 0.5);
  event.debris.speed = [debrisSpeedMin, debrisSpeedMax];
  event.particles = { ...config.particleCounts };
  event.palette = { ...config.palette };
  event.variant = projectile?.projectile?.bulletType;
  event.elapsed = 0;
  event.lightElapsed = 0;

  state.explosions.push(event);
  return event;
}

export function updateExplosions(state: GameState, delta: number): void {
  const active = state.explosions;
  for (let i = active.length - 1; i >= 0; i -= 1) {
    const event = active[i];
    event.elapsed += delta;
    if (event.lightElapsed < event.lightDuration) {
      event.lightElapsed = Math.min(event.lightDuration, event.lightElapsed + delta);
    }
    if (event.elapsed >= event.duration) {
      active.splice(i, 1);
      recycleExplosion(state, event);
    }
  }
}

export function resetExplosionOverflowWarning(): void {
  overflowWarned = false;
}
