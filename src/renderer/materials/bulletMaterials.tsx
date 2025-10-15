import React from 'react';
import { MeshStandardMaterial } from 'three';

const laserProps = {
  color: '#ffd089',
  emissive: '#ff962f',
  emissiveIntensity: 1.8,
};

const plasmaProps = {
  color: '#c78bff',
  emissive: '#a04bff',
  emissiveIntensity: 2.2,
  roughness: 0.2,
  metalness: 0.1,
};

const ionProps = {
  color: '#bfe9ff',
  emissive: '#6fe8ff',
  emissiveIntensity: 3.0,
  roughness: 0.05,
  metalness: 0.0,
};

const heavyProps = {
  color: '#ffd6b3',
  emissive: '#ffb36b',
  emissiveIntensity: 1.2,
  roughness: 0.6,
  metalness: 0.2,
};

const missileProps = {
  color: '#f3ffba',
  emissive: '#d7ff63',
  emissiveIntensity: 2.4,
  roughness: 0.3,
  metalness: 0.15,
};

const torpedoProps = {
  color: '#ffcf9f',
  emissive: '#ff8e3c',
  emissiveIntensity: 2.0,
  roughness: 0.45,
  metalness: 0.25,
};

const beamProps = {
  color: '#9bd7ff',
  emissive: '#6fb3ff',
  emissiveIntensity: 3.5,
  roughness: 0.1,
  metalness: 0.05,
  transparent: true,
  opacity: 0.9,
};

export const BulletLaserMaterial: React.FC = () => <meshStandardMaterial {...laserProps} />;

export const BulletPlasmaMaterial: React.FC = () => <meshStandardMaterial {...plasmaProps} />;

export const BulletIonMaterial: React.FC = () => <meshStandardMaterial {...ionProps} />;

export const BulletHeavyMaterial: React.FC = () => <meshStandardMaterial {...heavyProps} />;

export const MissileLightMaterial: React.FC = () => <meshStandardMaterial {...missileProps} />;

export const TorpedoStandardMaterial: React.FC = () => <meshStandardMaterial {...torpedoProps} />;

export const BeamLaserMaterial: React.FC = () => (
  <meshStandardMaterial {...beamProps} userData={{ __copilot_forceColorWrite: true }} />
);

export function createBulletLaserMaterial(): MeshStandardMaterial {
  return new MeshStandardMaterial(laserProps);
}

export function createBulletPlasmaMaterial(): MeshStandardMaterial {
  return new MeshStandardMaterial(plasmaProps);
}

export function createBulletIonMaterial(): MeshStandardMaterial {
  return new MeshStandardMaterial(ionProps);
}

export function createBulletHeavyMaterial(): MeshStandardMaterial {
  return new MeshStandardMaterial(heavyProps);
}

export function createMissileLightMaterial(): MeshStandardMaterial {
  return new MeshStandardMaterial(missileProps);
}

export function createTorpedoStandardMaterial(): MeshStandardMaterial {
  return new MeshStandardMaterial(torpedoProps);
}

export function createBeamLaserMaterial(): MeshStandardMaterial {
  const material = new MeshStandardMaterial(beamProps);
  material.transparent = true;
  material.opacity = beamProps.opacity;
  if (!material.userData) {
    material.userData = {};
  }
  (material.userData as Record<string, unknown>).__copilot_forceColorWrite = true;
  return material;
}
