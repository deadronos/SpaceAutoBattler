import { describe, it, expect, beforeEach } from 'vite-plus/test';
import { Object3D, Mesh, BoxGeometry, MeshBasicMaterial, Group } from 'three';
import {
  isMesh,
  safeTraverse,
  saveLayerMasks,
  restoreLayerMasks,
  enableMainPassLayer,
  hasSavedLayerMask,
  getSavedLayerMask,
} from '../../../../src/renderer/bloom/layerMaskManager.js';
import { LEGACY_USER_DATA_KEYS } from '../../../../src/renderer/bloom/constants.js';

describe('layerMaskManager', () => {
  describe('isMesh', () => {
    it('returns true for Mesh objects', () => {
      const mesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
      expect(isMesh(mesh)).toBe(true);
    });

    it('returns false for Object3D', () => {
      const obj = new Object3D();
      expect(isMesh(obj)).toBe(false);
    });

    it('returns false for Group', () => {
      const group = new Group();
      expect(isMesh(group)).toBe(false);
    });
  });

  describe('safeTraverse', () => {
    it('calls callback for root object', () => {
      const obj = new Object3D();
      const visited: Object3D[] = [];
      safeTraverse(obj, (child) => visited.push(child));
      expect(visited).toContain(obj);
    });

    it('calls callback for all children', () => {
      const root = new Group();
      const child1 = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
      const child2 = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
      root.add(child1);
      root.add(child2);

      const visited: Object3D[] = [];
      safeTraverse(root, (child) => visited.push(child));

      expect(visited).toHaveLength(3);
      expect(visited).toContain(root);
      expect(visited).toContain(child1);
      expect(visited).toContain(child2);
    });

    it('handles callback errors gracefully', () => {
      const obj = new Object3D();
      expect(() => {
        safeTraverse(obj, () => {
          throw new Error('test error');
        });
      }).not.toThrow();
    });
  });

  describe('saveLayerMasks', () => {
    let mesh: Mesh;

    beforeEach(() => {
      mesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
      mesh.layers.mask = 0b11; // Layer 0 and 1 enabled
    });

    it('saves the current layer mask to userData', () => {
      saveLayerMasks(mesh);
      expect(mesh.userData[LEGACY_USER_DATA_KEYS.origLayerMask]).toBe(0b11);
    });

    it('does not overwrite existing saved mask', () => {
      mesh.userData[LEGACY_USER_DATA_KEYS.origLayerMask] = 0b111;
      mesh.layers.mask = 0b1111; // Changed mask
      saveLayerMasks(mesh);
      expect(mesh.userData[LEGACY_USER_DATA_KEYS.origLayerMask]).toBe(0b111);
    });

    it('saves masks for nested meshes', () => {
      const group = new Group();
      const child = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
      child.layers.mask = 0b1010;
      group.add(mesh);
      group.add(child);

      saveLayerMasks(group);

      expect(mesh.userData[LEGACY_USER_DATA_KEYS.origLayerMask]).toBe(0b11);
      expect(child.userData[LEGACY_USER_DATA_KEYS.origLayerMask]).toBe(0b1010);
    });

    it('initializes userData if missing', () => {
      const freshMesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
      (freshMesh as any).userData = undefined;
      saveLayerMasks(freshMesh);
      expect(freshMesh.userData).toBeDefined();
    });
  });

  describe('restoreLayerMasks', () => {
    let mesh: Mesh;

    beforeEach(() => {
      mesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
      mesh.layers.mask = 0b11;
    });

    it('restores the saved layer mask', () => {
      saveLayerMasks(mesh);
      mesh.layers.mask = 0b1111111; // Changed
      restoreLayerMasks(mesh);
      expect(mesh.layers.mask).toBe(0b11);
    });

    it('cleans up userData key after restore', () => {
      saveLayerMasks(mesh);
      restoreLayerMasks(mesh);
      expect(mesh.userData[LEGACY_USER_DATA_KEYS.origLayerMask]).toBeUndefined();
    });

    it('does nothing if no saved mask exists', () => {
      const originalMask = mesh.layers.mask;
      restoreLayerMasks(mesh);
      expect(mesh.layers.mask).toBe(originalMask);
    });

    it('restores masks for nested meshes', () => {
      const group = new Group();
      const child = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
      child.layers.mask = 0b1010;
      group.add(mesh);
      group.add(child);

      saveLayerMasks(group);
      mesh.layers.mask = 0b1111111;
      child.layers.mask = 0b1111111;

      restoreLayerMasks(group);

      expect(mesh.layers.mask).toBe(0b11);
      expect(child.layers.mask).toBe(0b1010);
    });
  });

  describe('enableMainPassLayer', () => {
    it('enables layer 0 on the object', () => {
      const mesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
      mesh.layers.mask = 0b10; // Only layer 1
      enableMainPassLayer(mesh);
      expect(mesh.layers.mask & 1).toBe(1); // Layer 0 now enabled
    });

    it('preserves other enabled layers', () => {
      const mesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
      mesh.layers.mask = 0b1010; // Layers 1 and 3
      enableMainPassLayer(mesh);
      expect(mesh.layers.mask).toBe(0b1011); // Layer 0 added
    });

    it('enables layer 0 on children', () => {
      const group = new Group();
      const child = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
      child.layers.mask = 0b10;
      group.add(child);
      group.layers.mask = 0b100;

      enableMainPassLayer(group);

      expect(group.layers.mask & 1).toBe(1);
      expect(child.layers.mask & 1).toBe(1);
    });
  });

  describe('hasSavedLayerMask', () => {
    it('returns true when mask is saved', () => {
      const mesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
      saveLayerMasks(mesh);
      expect(hasSavedLayerMask(mesh)).toBe(true);
    });

    it('returns false when no mask is saved', () => {
      const mesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
      expect(hasSavedLayerMask(mesh)).toBe(false);
    });

    it('returns false after restore', () => {
      const mesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
      saveLayerMasks(mesh);
      restoreLayerMasks(mesh);
      expect(hasSavedLayerMask(mesh)).toBe(false);
    });
  });

  describe('getSavedLayerMask', () => {
    it('returns the saved mask', () => {
      const mesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
      mesh.layers.mask = 0b10101;
      saveLayerMasks(mesh);
      expect(getSavedLayerMask(mesh)).toBe(0b10101);
    });

    it('returns undefined when no mask is saved', () => {
      const mesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
      expect(getSavedLayerMask(mesh)).toBeUndefined();
    });
  });
});
