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

export const BulletLaserMaterial: React.FC = () => (
  <meshStandardMaterial {...laserProps} />
);

export const BulletPlasmaMaterial: React.FC = () => (
  <meshStandardMaterial {...plasmaProps} />
);

export const BulletIonMaterial: React.FC = () => (
  <meshStandardMaterial {...ionProps} />
);

export const BulletHeavyMaterial: React.FC = () => (
  <meshStandardMaterial {...heavyProps} />
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
