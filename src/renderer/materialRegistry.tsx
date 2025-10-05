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

export interface InstanceFriendlyMaterialOptions {
  requireInstanceColor?: boolean;
  fallbackKey?: MaterialKey;
  fallbackFactory?: () => InstancedMaterialInfo;
  onFallback?: (details: InstanceFriendlyFallbackDetails) => void;
}

export interface InstanceFriendlyFallbackDetails {
  requestedKey: MaterialKey;
  resolvedKey: MaterialKey | null;
  reason: 'missing' | 'no-instance-color';
}

const defaultInstanceColorFactory = (): InstancedMaterialInfo => {
  const material = new MeshStandardMaterial({
    color: '#ffffff',
    emissive: '#000000',
    emissiveIntensity: 1,
    vertexColors: true,
    transparent: true,
    opacity: 1,
    roughness: 0.4,
    metalness: 0.05,
  });
  material.name = 'instance-friendly-fallback';
  return {
    material,
    supportsInstanceColor: true,
  };
};

export function getInstanceFriendlyMaterial(
  key: MaterialKey,
  options: InstanceFriendlyMaterialOptions = {},
): InstancedMaterialInfo {
  const {
    requireInstanceColor = false,
    fallbackKey,
    fallbackFactory = defaultInstanceColorFactory,
    onFallback,
  } = options;

  const entry = registry.get(key);
  const info = createInstancedMaterial(key, fallbackFactory);
  if (!requireInstanceColor) {
    return info;
  }

  if (info.supportsInstanceColor) {
    return info;
  }

  if (fallbackKey && fallbackKey !== key) {
    const fallbackInfo = getInstanceFriendlyMaterial(fallbackKey, {
      requireInstanceColor: true,
      fallbackFactory,
      onFallback,
    });

    if (fallbackInfo.supportsInstanceColor) {
      onFallback?.({ requestedKey: key, resolvedKey: fallbackKey, reason: 'no-instance-color' });
      info.material.dispose();
      return fallbackInfo;
    }
  }

  const reason: InstanceFriendlyFallbackDetails['reason'] = entry ? 'no-instance-color' : 'missing';
  onFallback?.({ requestedKey: key, resolvedKey: null, reason });
  info.material.dispose();
  return fallbackFactory();
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
