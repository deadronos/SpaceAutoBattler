import React from 'react';
import { ShieldHexMaterial, ShieldTransmissionMaterial } from './shields/index.js';
import {
  BulletLaserMaterial,
  BulletPlasmaMaterial,
  BulletIonMaterial,
  BulletHeavyMaterial,
  ExplosionSmokeMaterial,
} from './materials/index.js';

export type MaterialKey = string;

type MaterialComponent<P = any> = React.FC<P>;

const registry = new Map<MaterialKey, MaterialComponent<any>>();

export function registerMaterial<P>(key: MaterialKey, comp: MaterialComponent<P>): void {
  registry.set(key, comp as MaterialComponent<any>);
}

export function getMaterial<P = any>(key: MaterialKey): MaterialComponent<P> | undefined {
  return registry.get(key) as MaterialComponent<P> | undefined;
}

// Register built-in materials
registerMaterial('shield:hex', ShieldHexMaterial);
registerMaterial('shield:meshtransmission', ShieldTransmissionMaterial);
registerMaterial('bullet:laser', BulletLaserMaterial);
registerMaterial('bullet:plasma', BulletPlasmaMaterial);
registerMaterial('bullet:ion', BulletIonMaterial);
registerMaterial('bullet:heavy', BulletHeavyMaterial);
registerMaterial('explosion:smoke', ExplosionSmokeMaterial);

// Re-export shield materials and types for backward compatibility
export { ShieldHexMaterial, ShieldTransmissionMaterial, createShieldHexShaderMaterial } from './shields/index.js';
export type { ShieldHexMaterialProps, ShieldTransmissionMaterialProps } from './shields/index.js';
