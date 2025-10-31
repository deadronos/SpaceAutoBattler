import { Vector3 } from 'three';
import type { TurretSpec } from '../../types/index.js';

/**
 * Factory functions for creating common turret configurations.
 * Reduces duplication across ship definitions by centralizing turret patterns.
 */

export function createPlasmaTurret(
  offset: Vector3,
  options: Partial<TurretSpec> = {},
): TurretSpec {
  return {
    offset,
    damage: 8,
    fireRate: 1.2,
    projectileSpeed: 67,
    range: 260,
    bulletType: 'bullet:plasma',
    minYaw: -Math.PI * 0.5,
    maxYaw: Math.PI * 0.5,
    minPitch: -Math.PI * 0.2,
    maxPitch: Math.PI * 0.5,
    priority: 'any',
    ...options,
  };
}

export function createLaserTurret(
  offset: Vector3,
  options: Partial<TurretSpec> = {},
): TurretSpec {
  return {
    offset,
    damage: 8,
    fireRate: 1.2,
    projectileSpeed: 107,
    range: 260,
    bulletType: 'bullet:laser',
    minYaw: -Math.PI * 0.9,
    maxYaw: Math.PI * 0.9,
    minPitch: -Math.PI * 0.3,
    maxPitch: Math.PI * 0.4,
    priority: 'antiFighter',
    ...options,
  };
}

export function createPointDefenseTurret(
  offset: Vector3,
  options: Partial<TurretSpec> = {},
): TurretSpec {
  return {
    offset,
    damage: 5,
    fireRate: 0.35,
    projectileSpeed: 240,
    range: 280,
    bulletType: 'bullet:laser',
    minYaw: -Math.PI * 0.85,
    maxYaw: Math.PI * 0.85,
    minPitch: -Math.PI * 0.35,
    maxPitch: Math.PI * 0.55,
    priority: 'antiFighter',
    ...options,
  };
}

export function createMissileTurret(
  offset: Vector3,
  options: Partial<TurretSpec> = {},
): TurretSpec {
  return {
    offset,
    damage: 20,
    fireRate: 2.8,
    projectileSpeed: 94,
    range: 560,
    bulletType: 'missile:light',
    projectileCategory: 'missile',
    minYaw: -Math.PI * 0.45,
    maxYaw: Math.PI * 0.45,
    minPitch: -Math.PI * 0.25,
    maxPitch: Math.PI * 0.35,
    priority: 'any',
    ...options,
  };
}

export function createBeamTurret(
  offset: Vector3,
  options: Partial<TurretSpec> = {},
): TurretSpec {
  return {
    offset,
    damage: 16,
    fireRate: 2.2,
    projectileSpeed: 0,
    range: 320,
    bulletType: 'beam:laser',
    projectileCategory: 'beam',
    minYaw: -Math.PI * 0.6,
    maxYaw: Math.PI * 0.6,
    minPitch: -Math.PI * 0.3,
    maxPitch: Math.PI * 0.5,
    priority: 'antiFighter',
    ...options,
  };
}
