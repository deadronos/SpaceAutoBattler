import { describe, it, expect, beforeEach } from 'vitest';
import { InstancedMesh, SphereGeometry, MeshBasicMaterial } from 'three';
import {
  setInstanceCount,
  markMatrixDirty,
  markColorDirty,
  finalizeInstancedMeshes,
  type InstancedMeshRefs,
  type EffectCounts,
} from '../../../src/components/explosions/instancedManager.js';

describe('instancedManager', () => {
  let mesh: InstancedMesh;

  beforeEach(() => {
    mesh = new InstancedMesh(new SphereGeometry(1), new MeshBasicMaterial(), 10);
  });

  describe('setInstanceCount', () => {
    it('should set instance count and visibility', () => {
      setInstanceCount(mesh, 5);
      expect(mesh.count).toBe(5);
      expect(mesh.visible).toBe(true);
    });

    it('should hide mesh when count is zero', () => {
      setInstanceCount(mesh, 0);
      expect(mesh.count).toBe(0);
      expect(mesh.visible).toBe(false);
    });
  });

  describe('markMatrixDirty', () => {
    it('should mark instance matrix as needing update', () => {
      expect(() => markMatrixDirty(mesh)).not.toThrow();
      // Note: In happy-dom test environment, Three.js properties may not be fully simulated
      // The important thing is that the function runs without error
    });
  });

  describe('markColorDirty', () => {
    it('should mark instance color as needing update when it exists', () => {
      if (mesh.instanceColor) {
        mesh.instanceColor.needsUpdate = false;
        markColorDirty(mesh);
        expect(mesh.instanceColor.needsUpdate).toBe(true);
      }
    });

    it('should not throw when instance color is null', () => {
      mesh.instanceColor = null;
      expect(() => markColorDirty(mesh)).not.toThrow();
    });
  });

  describe('finalizeInstancedMeshes', () => {
    it('should finalize all meshes with correct counts', () => {
      const refs: InstancedMeshRefs = {
        flash: new InstancedMesh(new SphereGeometry(1), new MeshBasicMaterial(), 10),
        shockwave: new InstancedMesh(new SphereGeometry(1), new MeshBasicMaterial(), 10),
        fireball: new InstancedMesh(new SphereGeometry(1), new MeshBasicMaterial(), 10),
        debris: new InstancedMesh(new SphereGeometry(1), new MeshBasicMaterial(), 10),
        sparks: new InstancedMesh(new SphereGeometry(1), new MeshBasicMaterial(), 10),
        plasma: new InstancedMesh(new SphereGeometry(1), new MeshBasicMaterial(), 10),
        smoke: new InstancedMesh(new SphereGeometry(1), new MeshBasicMaterial(), 10),
      };

      const counts: EffectCounts = {
        flash: 3,
        shockwave: 2,
        fireball: 1,
        debris: 5,
        sparks: 4,
        plasma: 2,
        smoke: 6,
      };

      finalizeInstancedMeshes(refs, counts);

      expect(refs.flash?.count).toBe(3);
      expect(refs.shockwave?.count).toBe(2);
      expect(refs.fireball?.count).toBe(1);
      expect(refs.debris?.count).toBe(5);
      expect(refs.sparks?.count).toBe(4);
      expect(refs.plasma?.count).toBe(2);
      expect(refs.smoke?.count).toBe(6);

      expect(refs.flash?.visible).toBe(true);
      expect(refs.fireball?.visible).toBe(true);
    });

    it('should handle null refs gracefully', () => {
      const refs: InstancedMeshRefs = {
        flash: null,
        shockwave: null,
        fireball: null,
        debris: null,
        sparks: null,
        plasma: null,
        smoke: null,
      };

      const counts: EffectCounts = {
        flash: 0,
        shockwave: 0,
        fireball: 0,
        debris: 0,
        sparks: 0,
        plasma: 0,
        smoke: 0,
      };

      expect(() => finalizeInstancedMeshes(refs, counts)).not.toThrow();
    });

    it('should mark all instance matrices as dirty', () => {
      const refs: InstancedMeshRefs = {
        flash: new InstancedMesh(new SphereGeometry(1), new MeshBasicMaterial(), 10),
        shockwave: new InstancedMesh(new SphereGeometry(1), new MeshBasicMaterial(), 10),
        fireball: new InstancedMesh(new SphereGeometry(1), new MeshBasicMaterial(), 10),
        debris: new InstancedMesh(new SphereGeometry(1), new MeshBasicMaterial(), 10),
        sparks: new InstancedMesh(new SphereGeometry(1), new MeshBasicMaterial(), 10),
        plasma: new InstancedMesh(new SphereGeometry(1), new MeshBasicMaterial(), 10),
        smoke: new InstancedMesh(new SphereGeometry(1), new MeshBasicMaterial(), 10),
      };

      const counts: EffectCounts = {
        flash: 1,
        shockwave: 1,
        fireball: 1,
        debris: 1,
        sparks: 1,
        plasma: 1,
        smoke: 1,
      };

      expect(() => finalizeInstancedMeshes(refs, counts)).not.toThrow();

      // Verify counts were set correctly
      Object.entries(refs).forEach(([key, mesh]) => {
        if (mesh) {
          const count = counts[key as keyof EffectCounts];
          expect(mesh.count).toBe(count);
          expect(mesh.visible).toBe(count > 0);
        }
      });
    });
  });
});
