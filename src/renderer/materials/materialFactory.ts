import { MeshBasicMaterial, MeshStandardMaterial } from 'three';
import type { MeshBasicMaterialParameters, MeshStandardMaterialParameters } from 'three';

/**
 * Generic factory function for creating MeshStandardMaterial instances.
 * @param preset - Material parameters object
 * @returns A new MeshStandardMaterial instance
 */
export function createStandardMaterial(
  preset: MeshStandardMaterialParameters,
): MeshStandardMaterial {
  return new MeshStandardMaterial(preset);
}

/**
 * Generic factory function for creating MeshBasicMaterial instances.
 * @param preset - Material parameters object
 * @returns A new MeshBasicMaterial instance
 */
export function createBasicMaterial(preset: MeshBasicMaterialParameters): MeshBasicMaterial {
  return new MeshBasicMaterial(preset);
}

/**
 * Creates a material from a preset with optional overrides.
 * This is a flexible factory that allows additional properties to be merged.
 * @param preset - Base material parameters
 * @param overrides - Optional parameter overrides
 * @returns A new MeshStandardMaterial or MeshBasicMaterial instance
 */
export function createMaterialFromPreset<T extends MeshStandardMaterialParameters>(
  preset: T,
  overrides?: Partial<T>,
): MeshStandardMaterial;
export function createMaterialFromPreset<T extends MeshBasicMaterialParameters>(
  preset: T,
  overrides?: Partial<T>,
): MeshBasicMaterial;
export function createMaterialFromPreset(
  preset: MeshStandardMaterialParameters | MeshBasicMaterialParameters,
  overrides?: Partial<MeshStandardMaterialParameters | MeshBasicMaterialParameters>,
): MeshStandardMaterial | MeshBasicMaterial {
  const mergedParams = { ...preset, ...overrides };

  // Determine material type based on presence of standard material properties
  if ('roughness' in mergedParams || 'metalness' in mergedParams || 'emissive' in mergedParams) {
    return new MeshStandardMaterial(mergedParams as MeshStandardMaterialParameters);
  }

  return new MeshBasicMaterial(mergedParams as MeshBasicMaterialParameters);
}
