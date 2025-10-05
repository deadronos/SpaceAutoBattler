import React from 'react';
import { AdditiveBlending, MeshStandardMaterial } from 'three';
import type { MeshStandardMaterialParameters } from 'three';

const muzzleProps: MeshStandardMaterialParameters = {
  color: '#ffd089',
  emissive: '#ff962f',
  emissiveIntensity: 6.0,
  transparent: true,
  opacity: 0.85,
  depthWrite: false,
  blending: AdditiveBlending,
};

export const MuzzleFlashMaterial: React.FC = () => <meshStandardMaterial {...muzzleProps} />;

export function createMuzzleFlashMaterial(): MeshStandardMaterial {
  return new MeshStandardMaterial(muzzleProps);
}
