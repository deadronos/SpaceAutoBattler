import React from 'react';
import { AdditiveBlending, MeshStandardMaterial } from 'three';

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
  color: '#ffd88c',
  emissive: '#ff7a1f',
  emissiveIntensity: 2.6,
  roughness: 0.22,
  metalness: 0.15,
};

const torpedoProps = {
  color: '#ffceb8',
  emissive: '#ff5330',
  emissiveIntensity: 2.8,
  roughness: 0.3,
  metalness: 0.2,
};

const beamProps = {
  color: '#c4f5ff',
  emissive: '#5fe6ff',
  emissiveIntensity: 4.2,
  roughness: 0.05,
  metalness: 0.0,
  transparent: true,
  opacity: 0.92,
  depthWrite: false,
  blending: AdditiveBlending,
  toneMapped: false,
};

export const BulletLaserMaterial: React.FC = () => <meshStandardMaterial {...laserProps} />;

export const BulletPlasmaMaterial: React.FC = () => <meshStandardMaterial {...plasmaProps} />;

export const BulletIonMaterial: React.FC = () => <meshStandardMaterial {...ionProps} />;

export const BulletHeavyMaterial: React.FC = () => <meshStandardMaterial {...heavyProps} />;

export const MissileMaterial: React.FC = () => <meshStandardMaterial {...missileProps} />;

export const TorpedoMaterial: React.FC = () => <meshStandardMaterial {...torpedoProps} />;

export const BeamLaserMaterial: React.FC = () => <meshStandardMaterial {...beamProps} />;

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

export function createMissileMaterial(): MeshStandardMaterial {
  return new MeshStandardMaterial(missileProps);
}

export function createTorpedoMaterial(): MeshStandardMaterial {
  return new MeshStandardMaterial(torpedoProps);
}

export function createBeamLaserMaterial(): MeshStandardMaterial {
  return new MeshStandardMaterial(beamProps);
}
