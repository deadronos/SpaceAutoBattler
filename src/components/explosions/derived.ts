import { Color, Vector3 } from 'three';
import type { ExplosionEvent } from '../../types/index.js';
import { SeededRng } from '../../utils/rng.js';
import {
  MAX_DEBRIS,
  MAX_PLASMA,
  MAX_SMOKE,
  MAX_SPARKS,
  PLASMA_LIFETIME,
  SMOKE_LIFETIME,
  SPARKS_LIFETIME,
} from './constants.js';

export interface DerivedParticle {
  direction: Vector3;
  speed: number;
  lifetime: number;
  axis: Vector3;
  spin: number;
  scale: number;
}

export interface DerivedSmoke {
  offset: Vector3;
  drift: Vector3;
  scale: number;
  lifetime: number;
}

export interface DerivedExplosionData {
  flicker: number;
  debris: DerivedParticle[];
  sparks: DerivedParticle[];
  plasma: DerivedParticle[];
  smoke: DerivedSmoke[];
}

interface CachedDerived {
  seed: number;
  radius: number;
  hull: ExplosionEvent['hull'];
  data: DerivedExplosionData;
}

const derivedCache = new WeakMap<ExplosionEvent, CachedDerived>();
const colorCache = new Map<string, Color>();

export function getCachedColor(value: string): Color {
  let color = colorCache.get(value);
  if (!color) {
    color = new Color(value);
    colorCache.set(value, color);
  }
  return color;
}

export function randomUnitVector(rng: SeededRng): Vector3 {
  const u = rng.next();
  const v = rng.next();
  const theta = 2 * Math.PI * u;
  const phi = Math.acos(2 * v - 1);
  const sinPhi = Math.sin(phi);
  return new Vector3(Math.cos(theta) * sinPhi, Math.sin(theta) * sinPhi, Math.cos(phi));
}

function createDerived(event: ExplosionEvent): DerivedExplosionData {
  const rng = new SeededRng(Math.max(1, event.seed || 1));
  const debris: DerivedParticle[] = [];
  const sparks: DerivedParticle[] = [];
  const plasma: DerivedParticle[] = [];
  const smoke: DerivedSmoke[] = [];

  for (let i = 0; i < Math.min(event.debris.count, MAX_DEBRIS); i += 1) {
    const direction = randomUnitVector(rng).normalize();
    const speed = rng.range(event.debris.speed[0], event.debris.speed[1]);
    const lifetime = rng.range(0.55, 0.95);
    const axis = randomUnitVector(rng).normalize();
    const spin = rng.range(-Math.PI, Math.PI);
    const scale = rng.range(0.6, 1.2);
    debris.push({ direction, speed, lifetime, axis, spin, scale });
  }

  for (let i = 0; i < Math.min(event.particles.sparks, MAX_SPARKS); i += 1) {
    const direction = randomUnitVector(rng).normalize();
    const speed = rng.range(event.radius * 2.5, event.radius * 3.5);
    const lifetime = rng.range(0.2, SPARKS_LIFETIME);
    const axis = randomUnitVector(rng).normalize();
    const spin = rng.range(-Math.PI, Math.PI);
    const scale = rng.range(0.4, 0.9);
    sparks.push({ direction, speed, lifetime, axis, spin, scale });
  }

  for (let i = 0; i < Math.min(event.particles.plasma, MAX_PLASMA); i += 1) {
    const direction = randomUnitVector(rng).normalize();
    const speed = rng.range(event.radius * 0.8, event.radius * 1.6);
    const lifetime = rng.range(0.6, PLASMA_LIFETIME);
    const axis = randomUnitVector(rng).normalize();
    const spin = rng.range(-Math.PI, Math.PI);
    const scale = rng.range(0.8, 1.4);
    plasma.push({ direction, speed, lifetime, axis, spin, scale });
  }

  for (let i = 0; i < Math.min(event.particles.smoke, MAX_SMOKE); i += 1) {
    const offsetDir = randomUnitVector(rng).normalize();
    offsetDir.y = Math.abs(offsetDir.y);
    const driftDir = randomUnitVector(rng).normalize();
    driftDir.y = Math.abs(driftDir.y);
    const offset = offsetDir.multiplyScalar(event.radius * rng.range(0.15, 0.35));
    const drift = driftDir.multiplyScalar(rng.range(event.radius * 0.08, event.radius * 0.16));
    const scale = rng.range(0.6, 1.6);
    const lifetime = rng.range(1.1, SMOKE_LIFETIME);
    smoke.push({ offset, drift, scale, lifetime });
  }

  return {
    flicker: rng.range(0.85, 1.15),
    debris,
    sparks,
    plasma,
    smoke,
  };
}

export function getDerived(event: ExplosionEvent): DerivedExplosionData {
  const cached = derivedCache.get(event);
  if (
    cached &&
    cached.seed === event.seed &&
    cached.radius === event.radius &&
    cached.hull === event.hull
  ) {
    return cached.data;
  }
  const data = createDerived(event);
  derivedCache.set(event, {
    seed: event.seed,
    radius: event.radius,
    hull: event.hull,
    data,
  });
  return data;
}

export function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
