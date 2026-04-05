import type { Material, Mesh } from 'three';

export function resolveMaterial(material: Mesh['material']): Material | null {
  if (Array.isArray(material)) {
    return (material[0] as Material | undefined) ?? null;
  }
  return material ?? null;
}
