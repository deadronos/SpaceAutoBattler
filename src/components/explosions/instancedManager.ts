import type { InstancedMesh } from 'three';

export interface InstancedMeshRefs {
  flash: InstancedMesh | null;
  shockwave: InstancedMesh | null;
  fireball: InstancedMesh | null;
  debris: InstancedMesh | null;
  sparks: InstancedMesh | null;
  plasma: InstancedMesh | null;
  smoke: InstancedMesh | null;
}

export interface EffectCounts {
  flash: number;
  shockwave: number;
  fireball: number;
  debris: number;
  sparks: number;
  plasma: number;
  smoke: number;
}

/**
 * Sets the instance count for a mesh and marks it as needing update.
 */
export function setInstanceCount(mesh: InstancedMesh, count: number): void {
  mesh.count = count;
  mesh.visible = count > 0;
}

/**
 * Marks the instance matrix as needing an update.
 */
export function markMatrixDirty(mesh: InstancedMesh): void {
  mesh.instanceMatrix.needsUpdate = true;
}

/**
 * Marks the instance color attribute as needing an update if it exists.
 */
export function markColorDirty(mesh: InstancedMesh): void {
  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }
}

/**
 * Finalizes all mesh updates by setting counts and marking attributes dirty.
 */
export function finalizeInstancedMeshes(
  refs: InstancedMeshRefs,
  counts: EffectCounts
): void {
  const meshes: Array<{ mesh: InstancedMesh | null; count: number }> = [
    { mesh: refs.flash, count: counts.flash },
    { mesh: refs.shockwave, count: counts.shockwave },
    { mesh: refs.fireball, count: counts.fireball },
    { mesh: refs.debris, count: counts.debris },
    { mesh: refs.sparks, count: counts.sparks },
    { mesh: refs.plasma, count: counts.plasma },
    { mesh: refs.smoke, count: counts.smoke },
  ];

  for (const { mesh, count } of meshes) {
    if (mesh) {
      setInstanceCount(mesh, count);
      markMatrixDirty(mesh);
      markColorDirty(mesh);
    }
  }
}
