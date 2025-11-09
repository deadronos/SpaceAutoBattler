import React from 'react';
import { MeshStandardMaterial } from 'three';
import {
  laserPreset,
  plasmaPreset,
  ionPreset,
  heavyPreset,
  missilePreset,
  torpedoPreset,
  beamPreset,
} from './materialPresets.js';
import { createStandardMaterial } from './materialFactory.js';

export const BulletLaserMaterial: React.FC = () => <meshStandardMaterial {...laserPreset} />;

export const BulletPlasmaMaterial: React.FC = () => <meshStandardMaterial {...plasmaPreset} />;

export const BulletIonMaterial: React.FC = () => <meshStandardMaterial {...ionPreset} />;

export const BulletHeavyMaterial: React.FC = () => <meshStandardMaterial {...heavyPreset} />;

export const MissileLightMaterial: React.FC = () => <meshStandardMaterial {...missilePreset} />;

export const TorpedoStandardMaterial: React.FC = () => <meshStandardMaterial {...torpedoPreset} />;

export const BeamLaserMaterial: React.FC = () => (
  <meshStandardMaterial {...beamPreset} userData={{ __copilot_forceColorWrite: true }} />
);

export function createBulletLaserMaterial(): MeshStandardMaterial {
  return createStandardMaterial(laserPreset);
}

export function createBulletPlasmaMaterial(): MeshStandardMaterial {
  return createStandardMaterial(plasmaPreset);
}

export function createBulletIonMaterial(): MeshStandardMaterial {
  return createStandardMaterial(ionPreset);
}

export function createBulletHeavyMaterial(): MeshStandardMaterial {
  return createStandardMaterial(heavyPreset);
}

export function createMissileLightMaterial(): MeshStandardMaterial {
  return createStandardMaterial(missilePreset);
}

export function createTorpedoStandardMaterial(): MeshStandardMaterial {
  return createStandardMaterial(torpedoPreset);
}

export function createBeamLaserMaterial(): MeshStandardMaterial {
  const material = createStandardMaterial(beamPreset);
  material.transparent = true;
  material.opacity = beamPreset.opacity ?? 0.9;
  if (!material.userData) {
    material.userData = {};
  }
  (material.userData as Record<string, unknown>).__copilot_forceColorWrite = true;
  return material;
}
