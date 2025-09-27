import { Vector3 } from 'three';
import type {
  ExplosionEvent,
  GameState,
  ProjectileEntity,
  ShipEntity,
} from '../types/index.js';
import { DEFAULT_EXPLOSION_CONFIG, getExplosionConfig } from '../config/explosions.js';

const MAX_EXPLOSIONS = 48;
const DEFAULT_DURATION = 1.8;
const DEFAULT_LIGHT_DURATION = 0.25;
const SHOCKWAVE_DELAY = 0.08;
const SHOCKWAVE_DURATION = 0.32;
const FIREBALL_DELAY = 0.2;
const FIREBALL_DURATION = 0.4;
const BASE_DEBRIS_SPEED: [number, number] = [12, 26];

let overflowWarned = false;

function obtainExplosion(state: GameState): ExplosionEvent {
  const pooled = state.explosionPool.pop();
  if (pooled) {
    return pooled;
  }
  return {
    id: 0,
    seed: 0,
    faction: 'alliance',
    hull: 'fighter',
    position: new Vector3(),
    radius: 0,
    startTime: 0,
    duration: DEFAULT_DURATION,
    lightDuration: DEFAULT_LIGHT_DURATION,
    lightFalloff: DEFAULT_EXPLOSION_CONFIG.lightFalloff,
    lightColor: DEFAULT_EXPLOSION_CONFIG.lightColor,
    flashIntensity: DEFAULT_EXPLOSION_CONFIG.flashIntensity,
    shockwave: { delay: SHOCKWAVE_DELAY, duration: SHOCKWAVE_DURATION, maxRadius: 0 },
    fireball: { delay: FIREBALL_DELAY, duration: FIREBALL_DURATION },
    debris: { count: DEFAULT_EXPLOSION_CONFIG.debrisCount, speed: [...BASE_DEBRIS_SPEED] as [number, number] },
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

function teamToFaction(team: ShipEntity['ship']['team']): 'alliance' | 'ravers' {
  return team === 'blue' ? 'alliance' : 'ravers';
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
  event.duration = DEFAULT_DURATION;
  event.lightDuration = DEFAULT_LIGHT_DURATION;
  event.lightFalloff = config.lightFalloff;
  event.lightColor = config.lightColor;
  event.flashIntensity = config.flashIntensity;
  event.shockwave.delay = SHOCKWAVE_DELAY;
  event.shockwave.duration = SHOCKWAVE_DURATION;
  event.shockwave.maxRadius = radius * 1.8;
  event.fireball.delay = FIREBALL_DELAY;
  event.fireball.duration = FIREBALL_DURATION;
  event.debris.count = config.debrisCount;
  const debrisSpeedMin = BASE_DEBRIS_SPEED[0] * (0.6 + ship.transform.scale * 0.4);
  const debrisSpeedMax = BASE_DEBRIS_SPEED[1] * (0.7 + ship.transform.scale * 0.5);
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
