import React from 'react';
import type { Material } from 'three';
import { MeshStandardMaterial } from 'three';
import { ShieldHexMaterial, ShieldTransmissionMaterial } from './shields/index.js';
import {
  BulletLaserMaterial,
  BulletPlasmaMaterial,
  BulletIonMaterial,
  BulletHeavyMaterial,
  MissileLightMaterial,
  TorpedoStandardMaterial,
  BeamLaserMaterial,
  ExplosionSmokeMaterial,
  createBulletLaserMaterial,
  createBulletPlasmaMaterial,
  createBulletIonMaterial,
  createBulletHeavyMaterial,
  createMissileLightMaterial,
  createTorpedoStandardMaterial,
  createBeamLaserMaterial,
  MuzzleFlashMaterial,
  createMuzzleFlashMaterial,
  createThrusterGlowMaterial,
  createShipImpostorMaterial,
} from './materials/index.js';

export type MaterialKey = string;

type MaterialComponent<P = any> = React.FC<P>;

const NullMaterialComponent: React.FC = () => null;

interface MaterialDefinition<P = any> {
  component: MaterialComponent<P>;
  create?: () => Material;
  supportsInstanceColor?: boolean;
  supportsInstanceUv?: boolean;
}

interface MaterialRegistrationOptions {
  create?: () => Material;
  supportsInstanceColor?: boolean;
  supportsInstanceUv?: boolean;
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
    supportsInstanceUv: options.supportsInstanceUv,
  });
}

export function getMaterial<P = any>(key: MaterialKey): MaterialComponent<P> | undefined {
  const entry = registry.get(key);
  return entry?.component as MaterialComponent<P> | undefined;
}

export interface InstancedMaterialInfo {
  material: Material;
  supportsInstanceColor: boolean;
  supportsInstanceUv: boolean;
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
      supportsInstanceUv: entry.supportsInstanceUv ?? false,
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
    supportsInstanceUv: false,
  };
}

export interface InstanceFriendlyMaterialOptions {
  requireInstanceColor?: boolean;
  requireInstanceUv?: boolean;
  fallbackKey?: MaterialKey;
  fallbackFactory?: () => InstancedMaterialInfo;
  onFallback?: (details: InstanceFriendlyFallbackDetails) => void;
}

export interface InstanceFriendlyFallbackDetails {
  requestedKey: MaterialKey;
  resolvedKey: MaterialKey | null;
  reason: 'missing' | 'no-instance-color' | 'no-instance-uv';
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
    supportsInstanceUv: true,
  };
};

export function getInstanceFriendlyMaterial(
  key: MaterialKey,
  options: InstanceFriendlyMaterialOptions = {},
): InstancedMaterialInfo {
  const {
    requireInstanceColor = false,
    requireInstanceUv = false,
    fallbackKey,
    fallbackFactory = defaultInstanceColorFactory,
    onFallback,
  } = options;

  const entry = registry.get(key);
  const info = createInstancedMaterial(key, fallbackFactory);
  if (!requireInstanceColor && !requireInstanceUv) {
    return info;
  }

  const colorOk = !requireInstanceColor || info.supportsInstanceColor;
  const uvOk = !requireInstanceUv || info.supportsInstanceUv;

  if (colorOk && uvOk) {
    return info;
  }

  if (fallbackKey && fallbackKey !== key) {
    const fallbackInfo = getInstanceFriendlyMaterial(fallbackKey, {
      requireInstanceColor: true,
      requireInstanceUv: requireInstanceUv,
      fallbackFactory,
      onFallback,
    });

    const fallbackColorOk = !requireInstanceColor || fallbackInfo.supportsInstanceColor;
    const fallbackUvOk = !requireInstanceUv || fallbackInfo.supportsInstanceUv;

    if (fallbackColorOk && fallbackUvOk) {
      const reason: InstanceFriendlyFallbackDetails['reason'] = !colorOk
        ? 'no-instance-color'
        : 'no-instance-uv';
      onFallback?.({ requestedKey: key, resolvedKey: fallbackKey, reason });
      info.material.dispose();
      return fallbackInfo;
    }
  }

  let reason: InstanceFriendlyFallbackDetails['reason'];
  if (!entry) {
    reason = 'missing';
  } else if (!colorOk) {
    reason = 'no-instance-color';
  } else {
    reason = 'no-instance-uv';
  }
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
registerMaterial('missile:light', MissileLightMaterial, {
  create: createMissileLightMaterial,
});
registerMaterial('torpedo:standard', TorpedoStandardMaterial, {
  create: createTorpedoStandardMaterial,
});
registerMaterial('beam:laser', BeamLaserMaterial, {
  create: createBeamLaserMaterial,
  supportsInstanceColor: true,
});
registerMaterial('explosion:smoke', ExplosionSmokeMaterial);
registerMaterial('muzzle:flash', MuzzleFlashMaterial, {
  create: createMuzzleFlashMaterial,
  supportsInstanceColor: true,
});
registerMaterial('thruster:glow', NullMaterialComponent, {
  create: createThrusterGlowMaterial,
  supportsInstanceColor: true,
  supportsInstanceUv: false,
});
registerMaterial('ship:impostor', NullMaterialComponent, {
  create: createShipImpostorMaterial,
  supportsInstanceColor: true,
  supportsInstanceUv: true,
});

// Re-export shield materials and types for backward compatibility
export {
  ShieldHexMaterial,
  ShieldTransmissionMaterial,
  createShieldHexShaderMaterial,
} from './shields/index.js';
export type { ShieldHexMaterialProps, ShieldTransmissionMaterialProps } from './shields/index.js';
