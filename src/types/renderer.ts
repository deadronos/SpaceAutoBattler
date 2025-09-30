import type { ColorRepresentation, Vector3 } from 'three';
import type { ShipHull } from './gameplay.js';

export interface ExplosionEvent {
  id: number;
  seed: number;
  faction: 'alliance' | 'reavers';
  hull: ShipHull;
  position: Vector3;
  radius: number;
  startTime: number;
  duration: number;
  lightDuration: number;
  lightFalloff: number;
  lightColor: ColorRepresentation;
  flashIntensity: number;
  shockwave: { delay: number; duration: number; maxRadius: number };
  fireball: { delay: number; duration: number };
  debris: { count: number; speed: [number, number] };
  particles: { sparks: number; plasma: number; smoke: number };
  palette: {
    flash: string;
    shockwave: string;
    fireballHot: string;
    smoke: string;
  };
  variant?: string;
  elapsed: number;
  lightElapsed: number;
}

export interface ExplosionConfigEntry {
  baseRadius: number;
  flashIntensity: number;
  lightColor: ColorRepresentation;
  lightFalloff: number;
  debrisCount: number;
  particleCounts: { sparks: number; plasma: number; smoke: number };
  palette: {
    flash: string;
    shockwave: string;
    fireballHot: string;
    smoke: string;
  };
  timing: {
    duration: number;
    lightDuration: number;
    shockwave: { delay: number; duration: number };
    fireball: { delay: number; duration: number };
    debrisSpeed: [number, number];
  };
  /** Multiplier applied to the configured explosion radius to compute the shockwave max radius. Default: 1.8 */
  shockwaveMaxRadiusMulti?: number;
}
