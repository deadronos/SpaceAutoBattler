import React from 'react';
import type { ShieldRipple, ShipHull, Team } from '../types/index.js';
import { ShieldHexMaterial } from './shaders/shieldHexShader.js';
import { ShieldTransmissionMaterial } from './materials/shieldMaterials.js';
import {
  BulletLaserMaterial,
  BulletPlasmaMaterial,
  BulletIonMaterial,
  BulletHeavyMaterial,
} from './materials/bulletMaterials.js';
import { ExplosionSmokeMaterial } from './materials/explosionMaterials.js';

export type MaterialKey = string;

type ShieldMaterialProps = {
  hull: ShipHull;
  team: Team;
  opacity: number;
  ripple?: ShieldRipple;
  simTime?: number;
};

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

export type { ShieldMaterialProps };
export { ShieldHexMaterial, ShieldTransmissionMaterial };
