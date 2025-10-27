import type { MeshBasicMaterialParameters, MeshStandardMaterialParameters } from 'three';
import { AdditiveBlending, Color } from 'three';

/**
 * Centralized material preset definitions.
 * All preset objects are defined here to avoid duplication across material files.
 */

// Bullet material presets
export const laserPreset: MeshStandardMaterialParameters = {
  color: '#ffd089',
  emissive: '#ff962f',
  emissiveIntensity: 1.8,
};

export const plasmaPreset: MeshStandardMaterialParameters = {
  color: '#c78bff',
  emissive: '#a04bff',
  emissiveIntensity: 2.2,
  roughness: 0.2,
  metalness: 0.1,
};

export const ionPreset: MeshStandardMaterialParameters = {
  color: '#bfe9ff',
  emissive: '#6fe8ff',
  emissiveIntensity: 3.0,
  roughness: 0.05,
  metalness: 0.0,
};

export const heavyPreset: MeshStandardMaterialParameters = {
  color: '#ffd6b3',
  emissive: '#ffb36b',
  emissiveIntensity: 1.2,
  roughness: 0.6,
  metalness: 0.2,
};

export const missilePreset: MeshStandardMaterialParameters = {
  color: '#f3ffba',
  emissive: '#d7ff63',
  emissiveIntensity: 2.4,
  roughness: 0.3,
  metalness: 0.15,
};

export const torpedoPreset: MeshStandardMaterialParameters = {
  color: '#ffcf9f',
  emissive: '#ff8e3c',
  emissiveIntensity: 2.0,
  roughness: 0.45,
  metalness: 0.25,
};

export const beamPreset: MeshStandardMaterialParameters = {
  color: '#9bd7ff',
  emissive: '#6fb3ff',
  emissiveIntensity: 3.5,
  roughness: 0.1,
  metalness: 0.05,
  transparent: true,
  opacity: 0.9,
};

// Muzzle flash preset
export const muzzleFlashPreset: MeshStandardMaterialParameters = {
  color: '#ffd089',
  emissive: '#ff962f',
  emissiveIntensity: 6.0,
  transparent: true,
  opacity: 0.85,
  depthWrite: false,
  blending: AdditiveBlending,
};

// Thruster glow preset
export const thrusterGlowPreset: MeshBasicMaterialParameters = {
  color: new Color('#5fb6ff'),
  transparent: true,
  opacity: 0.85,
  depthWrite: false,
  blending: AdditiveBlending,
  vertexColors: true,
};

// Ship impostor preset
export const shipImpostorPreset: MeshBasicMaterialParameters = {
  color: new Color('#8fa2ff'),
  transparent: true,
  opacity: 0.9,
  depthWrite: false,
  depthTest: true,
  vertexColors: true,
};

// Explosion smoke preset
export const explosionSmokePreset: MeshStandardMaterialParameters = {
  color: '#55585c',
  roughness: 0.9,
  metalness: 0,
};
