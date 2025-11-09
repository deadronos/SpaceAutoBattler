import React from 'react';
import { MeshStandardMaterial } from 'three';
import { muzzleFlashPreset } from './materialPresets.js';
import { createStandardMaterial } from './materialFactory.js';

export const MuzzleFlashMaterial: React.FC = () => <meshStandardMaterial {...muzzleFlashPreset} />;

export function createMuzzleFlashMaterial(): MeshStandardMaterial {
  return createStandardMaterial(muzzleFlashPreset);
}
