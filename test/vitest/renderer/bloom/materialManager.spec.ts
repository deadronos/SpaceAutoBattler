import { describe, it, expect } from 'vite-plus/test';
import { Mesh, BoxGeometry, MeshBasicMaterial, MeshStandardMaterial, Group } from 'three';
import {
  hasForceColorWrite,
  getMaterials,
  saveColorWriteState,
  applyBloomColorWrite,
  restoreColorWriteState,
  syncColorWriteForObjects,
  hasSavedColorWriteState,
} from '../../../../src/renderer/bloom/materialManager.js';
import { LEGACY_USER_DATA_KEYS } from '../../../../src/renderer/bloom/constants.js';

describe('materialManager', () => {
  describe('hasForceColorWrite', () => {
    it('returns true when force flag is set', () => {
      const mat = new MeshBasicMaterial();
      mat.userData = { [LEGACY_USER_DATA_KEYS.forceColorWrite]: true };
      expect(hasForceColorWrite(mat)).toBe(true);
    });

    it('returns false when force flag is not set', () => {
      const mat = new MeshBasicMaterial();
      expect(hasForceColorWrite(mat)).toBe(false);
    });

    it('returns false for falsy force flag value', () => {
      const mat = new MeshBasicMaterial();
      mat.userData = { [LEGACY_USER_DATA_KEYS.forceColorWrite]: false };
      expect(hasForceColorWrite(mat)).toBe(false);
    });

    it('returns false when userData is undefined', () => {
      const mat = new MeshBasicMaterial();
      (mat as any).userData = undefined;
      expect(hasForceColorWrite(mat)).toBe(false);
    });
  });

  describe('getMaterials', () => {
    it('returns single material as array', () => {
      const mat = new MeshBasicMaterial();
      const mesh = new Mesh(new BoxGeometry(1, 1, 1), mat);
      const result = getMaterials(mesh);
      expect(result).toHaveLength(1);
      expect(result[0]).toBe(mat);
    });

    it('returns multi-material array as-is', () => {
      const mat1 = new MeshBasicMaterial();
      const mat2 = new MeshStandardMaterial();
      const mesh = new Mesh(new BoxGeometry(1, 1, 1), [mat1, mat2]);
      const result = getMaterials(mesh);
      expect(result).toHaveLength(2);
      expect(result).toContain(mat1);
      expect(result).toContain(mat2);
    });

    it('returns empty array when no material', () => {
      const mesh = new Mesh(new BoxGeometry(1, 1, 1));
      (mesh as any).material = null;
      const result = getMaterials(mesh);
      expect(result).toHaveLength(0);
    });
  });

  describe('saveColorWriteState', () => {
    it('saves colorWrite values to userData', () => {
      const mat = new MeshBasicMaterial();
      mat.colorWrite = true;
      const mesh = new Mesh(new BoxGeometry(1, 1, 1), mat);

      saveColorWriteState(mesh);

      const saved = mesh.userData[LEGACY_USER_DATA_KEYS.origColorWrite];
      expect(saved).toEqual([true]);
    });

    it('saves multiple materials colorWrite values', () => {
      const mat1 = new MeshBasicMaterial();
      mat1.colorWrite = true;
      const mat2 = new MeshBasicMaterial();
      mat2.colorWrite = false;
      const mesh = new Mesh(new BoxGeometry(1, 1, 1), [mat1, mat2]);

      saveColorWriteState(mesh);

      const saved = mesh.userData[LEGACY_USER_DATA_KEYS.origColorWrite];
      expect(saved).toEqual([true, false]);
    });

    it('saves undefined for materials without colorWrite', () => {
      const mat = {} as any; // Minimal mock
      const mesh = new Mesh(new BoxGeometry(1, 1, 1), mat);

      saveColorWriteState(mesh);

      const saved = mesh.userData[LEGACY_USER_DATA_KEYS.origColorWrite];
      expect(saved).toEqual([undefined]);
    });

    it('handles nested meshes', () => {
      const mat1 = new MeshBasicMaterial();
      mat1.colorWrite = true;
      const mat2 = new MeshBasicMaterial();
      mat2.colorWrite = false;

      const mesh1 = new Mesh(new BoxGeometry(1, 1, 1), mat1);
      const mesh2 = new Mesh(new BoxGeometry(1, 1, 1), mat2);
      const group = new Group();
      group.add(mesh1);
      group.add(mesh2);

      saveColorWriteState(group);

      expect(mesh1.userData[LEGACY_USER_DATA_KEYS.origColorWrite]).toEqual([true]);
      expect(mesh2.userData[LEGACY_USER_DATA_KEYS.origColorWrite]).toEqual([false]);
    });
  });

  describe('applyBloomColorWrite', () => {
    it('sets colorWrite=false for transparent materials when enabled', () => {
      const mat = new MeshBasicMaterial({ transparent: true });
      mat.colorWrite = true;
      const mesh = new Mesh(new BoxGeometry(1, 1, 1), mat);

      applyBloomColorWrite(mesh, true);

      expect(mat.colorWrite).toBe(false);
    });

    it('does nothing when enabled=false', () => {
      const mat = new MeshBasicMaterial({ transparent: true });
      mat.colorWrite = true;
      const mesh = new Mesh(new BoxGeometry(1, 1, 1), mat);

      applyBloomColorWrite(mesh, false);

      expect(mat.colorWrite).toBe(true);
    });

    it('does not modify opaque materials', () => {
      const mat = new MeshBasicMaterial({ transparent: false });
      mat.colorWrite = true;
      const mesh = new Mesh(new BoxGeometry(1, 1, 1), mat);

      applyBloomColorWrite(mesh, true);

      expect(mat.colorWrite).toBe(true);
    });

    it('respects force-write flag', () => {
      const mat = new MeshBasicMaterial({ transparent: true });
      mat.colorWrite = true;
      mat.userData = { [LEGACY_USER_DATA_KEYS.forceColorWrite]: true };
      const mesh = new Mesh(new BoxGeometry(1, 1, 1), mat);

      applyBloomColorWrite(mesh, true);

      expect(mat.colorWrite).toBe(true);
    });

    it('handles multiple materials', () => {
      const mat1 = new MeshBasicMaterial({ transparent: true });
      mat1.colorWrite = true;
      const mat2 = new MeshBasicMaterial({ transparent: false });
      mat2.colorWrite = true;
      const mat3 = new MeshBasicMaterial({ transparent: true });
      mat3.colorWrite = true;
      mat3.userData = { [LEGACY_USER_DATA_KEYS.forceColorWrite]: true };

      const mesh = new Mesh(new BoxGeometry(1, 1, 1), [mat1, mat2, mat3]);
      applyBloomColorWrite(mesh, true);

      expect(mat1.colorWrite).toBe(false); // Transparent, no force
      expect(mat2.colorWrite).toBe(true); // Opaque
      expect(mat3.colorWrite).toBe(true); // Has force flag
    });
  });

  describe('restoreColorWriteState', () => {
    it('restores original colorWrite values', () => {
      const mat = new MeshBasicMaterial({ transparent: true });
      mat.colorWrite = true;
      const mesh = new Mesh(new BoxGeometry(1, 1, 1), mat);

      saveColorWriteState(mesh);
      mat.colorWrite = false; // Changed by bloom
      restoreColorWriteState(mesh);

      expect(mat.colorWrite).toBe(true);
    });

    it('cleans up userData after restore', () => {
      const mat = new MeshBasicMaterial();
      const mesh = new Mesh(new BoxGeometry(1, 1, 1), mat);

      saveColorWriteState(mesh);
      restoreColorWriteState(mesh);

      expect(mesh.userData[LEGACY_USER_DATA_KEYS.origColorWrite]).toBeUndefined();
    });

    it('does nothing when no saved state exists', () => {
      const mat = new MeshBasicMaterial();
      mat.colorWrite = false;
      const mesh = new Mesh(new BoxGeometry(1, 1, 1), mat);

      restoreColorWriteState(mesh);

      expect(mat.colorWrite).toBe(false);
    });

    it('handles multi-material restore', () => {
      const mat1 = new MeshBasicMaterial();
      mat1.colorWrite = true;
      const mat2 = new MeshBasicMaterial();
      mat2.colorWrite = false;
      const mesh = new Mesh(new BoxGeometry(1, 1, 1), [mat1, mat2]);

      saveColorWriteState(mesh);
      mat1.colorWrite = false;
      mat2.colorWrite = true;
      restoreColorWriteState(mesh);

      expect(mat1.colorWrite).toBe(true);
      expect(mat2.colorWrite).toBe(false);
    });
  });

  describe('syncColorWriteForObjects', () => {
    it('applies colorWrite changes when enabling', () => {
      const mat = new MeshBasicMaterial({ transparent: true });
      mat.colorWrite = true;
      const mesh = new Mesh(new BoxGeometry(1, 1, 1), mat);
      saveColorWriteState(mesh);

      syncColorWriteForObjects([mesh], true);

      expect(mat.colorWrite).toBe(false);
    });

    it('restores colorWrite when disabling', () => {
      const mat = new MeshBasicMaterial({ transparent: true });
      mat.colorWrite = true;
      const mesh = new Mesh(new BoxGeometry(1, 1, 1), mat);

      saveColorWriteState(mesh);
      mat.colorWrite = false; // Changed
      syncColorWriteForObjects([mesh], false);

      expect(mat.colorWrite).toBe(true);
    });

    it('handles multiple objects', () => {
      const mat1 = new MeshBasicMaterial({ transparent: true });
      mat1.colorWrite = true;
      const mesh1 = new Mesh(new BoxGeometry(1, 1, 1), mat1);

      const mat2 = new MeshBasicMaterial({ transparent: true });
      mat2.colorWrite = true;
      const mesh2 = new Mesh(new BoxGeometry(1, 1, 1), mat2);

      saveColorWriteState(mesh1);
      saveColorWriteState(mesh2);

      syncColorWriteForObjects([mesh1, mesh2], true);

      expect(mat1.colorWrite).toBe(false);
      expect(mat2.colorWrite).toBe(false);
    });

    it('respects force-write flag during sync', () => {
      const mat = new MeshBasicMaterial({ transparent: true });
      mat.colorWrite = true;
      mat.userData = { [LEGACY_USER_DATA_KEYS.forceColorWrite]: true };
      const mesh = new Mesh(new BoxGeometry(1, 1, 1), mat);
      saveColorWriteState(mesh);

      syncColorWriteForObjects([mesh], true);

      expect(mat.colorWrite).toBe(true);
    });
  });

  describe('hasSavedColorWriteState', () => {
    it('returns true when state is saved', () => {
      const mesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
      saveColorWriteState(mesh);
      expect(hasSavedColorWriteState(mesh)).toBe(true);
    });

    it('returns false when no state is saved', () => {
      const mesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
      expect(hasSavedColorWriteState(mesh)).toBe(false);
    });

    it('returns false after restore', () => {
      const mesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
      saveColorWriteState(mesh);
      restoreColorWriteState(mesh);
      expect(hasSavedColorWriteState(mesh)).toBe(false);
    });
  });
});
