import { MeshBasicMaterial } from 'three';
import type { MeshBasicMaterialParameters } from 'three';
import { thrusterGlowPreset, shipImpostorPreset } from './materialPresets.js';
import { createBasicMaterial } from './materialFactory.js';

export function createThrusterGlowMaterial(
  parameters: MeshBasicMaterialParameters = {},
): MeshBasicMaterial {
  const material = createBasicMaterial({ ...thrusterGlowPreset, ...parameters });
  material.name = 'thruster-glow-instance';
  return material;
}

export function createShipImpostorMaterial(
  parameters: MeshBasicMaterialParameters = {},
): MeshBasicMaterial {
  const material = createBasicMaterial({ ...shipImpostorPreset, ...parameters });
  material.name = 'ship-impostor-instance';
  return material;
}
