import React from 'react';
import type { Material } from 'three';
import { MeshStandardMaterial } from 'three';
import { ShieldHexMaterial, ShieldTransmissionMaterial } from './shields/index.js';
import {
  BulletLaserMaterial,
  BulletPlasmaMaterial,
  BulletIonMaterial,
  BulletHeavyMaterial,
  ExplosionSmokeMaterial,
  createBulletLaserMaterial,
  createBulletPlasmaMaterial,
  createBulletIonMaterial,
  createBulletHeavyMaterial,
  MuzzleFlashMaterial,
  createMuzzleFlashMaterial,
} from './materials/index.js';

export type MaterialKey = string;

type MaterialComponent<P = any> = React.FC<P>;

interface MaterialDefinition<P = any> {
  component: MaterialComponent<P>;
  create?: () => Material;
  supportsInstanceColor?: boolean;
}

interface MaterialRegistrationOptions {
  create?: () => Material;
  supportsInstanceColor?: boolean;
}

const registry = new Map<MaterialKey, MaterialDefinition<any>>();

export function registerMaterial<P>(
  key: MaterialKey,
  comp: MaterialComponent<P>,
  options: MaterialRegistrationOptions = {},
): void {
  registry.set(key, {
    component: comp as MaterialComponent<any>,
    create: options.create,
    supportsInstanceColor: options.supportsInstanceColor,
  });
}

export function getMaterial<P = any>(key: MaterialKey): MaterialComponent<P> | undefined {
  const entry = registry.get(key);
  return entry?.component as MaterialComponent<P> | undefined;
}

export interface InstancedMaterialInfo {
  material: Material;
  supportsInstanceColor: boolean;
}

export function createInstancedMaterial(
  key: MaterialKey,
  fallback?: () => InstancedMaterialInfo,
): InstancedMaterialInfo {
  const entry = registry.get(key);
  if (entry?.create) {
    const material = entry.create();
    return {
      material,
      supportsInstanceColor: entry.supportsInstanceColor ?? false,
    };
  }
  if (fallback) {
    return fallback();
  }
  const defaultMaterial = new MeshStandardMaterial({
    color: '#ffd089',
    emissive: '#ff962f',
    emissiveIntensity: 1.8,
  });
  return {
    material: defaultMaterial,
    supportsInstanceColor: false,
  };
}

// Register built-in materials
registerMaterial('shield:hex', ShieldHexMaterial);
registerMaterial('shield:meshtransmission', ShieldTransmissionMaterial);
registerMaterial('bullet:laser', BulletLaserMaterial, {
  create: createBulletLaserMaterial,
});
registerMaterial('bullet:plasma', BulletPlasmaMaterial, {
  create: createBulletPlasmaMaterial,
});
registerMaterial('bullet:ion', BulletIonMaterial, {
  create: createBulletIonMaterial,
});
registerMaterial('bullet:heavy', BulletHeavyMaterial, {
  create: createBulletHeavyMaterial,
});
registerMaterial('explosion:smoke', ExplosionSmokeMaterial);
registerMaterial('muzzle:flash', MuzzleFlashMaterial, {
  create: createMuzzleFlashMaterial,
  supportsInstanceColor: true,
});

// Re-export shield materials and types for backward compatibility
export { ShieldHexMaterial, ShieldTransmissionMaterial, createShieldHexShaderMaterial } from './shields/index.js';
export type { ShieldHexMaterialProps, ShieldTransmissionMaterialProps } from './shields/index.js';
