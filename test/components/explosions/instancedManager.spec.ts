import { beforeEach, describe, expect, it } from 'vitest';
import { BufferGeometry, InstancedMesh, MeshBasicMaterial } from 'three';
import {
  ExplosionsInstancedManager,
  type InstancedMeshRefs,
} from '../../../src/components/explosions/instancedManager.js';

function createMesh(capacity: number): InstancedMesh {
  return new InstancedMesh(new BufferGeometry(), new MeshBasicMaterial(), capacity);
}

describe('ExplosionsInstancedManager', () => {
  let manager: ExplosionsInstancedManager;
  let refs: InstancedMeshRefs;

  beforeEach(() => {
    manager = new ExplosionsInstancedManager({
      flash: 4,
      shockwave: 4,
      fireball: 4,
      debris: 4,
      sparks: 4,
      plasma: 4,
      smoke: 4,
    });

    refs = {
      flash: createMesh(4),
      shockwave: createMesh(4),
      fireball: createMesh(4),
      debris: createMesh(4),
      sparks: createMesh(4),
      plasma: createMesh(4),
      smoke: createMesh(4),
    };
  });

  it('attaches refs and tracks counts', () => {
    expect(manager.attach(refs)).toBe(true);
    manager.beginFrame();
    expect(manager.getStartIndex('flash')).toBe(0);
    manager.commit('flash', { count: 2, saturated: false });
    expect(manager.getStartIndex('flash')).toBe(2);
    manager.finalize();
    expect(refs.flash?.count).toBe(2);
    expect(refs.flash?.visible).toBe(true);
  });

  it('handles saturation gracefully', () => {
    manager.attach(refs);
    manager.beginFrame();
    manager.commit('smoke', { count: 10, saturated: true });
    manager.finalize();
    expect(manager.wasSaturated('smoke')).toBe(true);
    expect(manager.anySaturated()).toBe(true);
    expect(refs.smoke?.count).toBe(4);
  });

  it('throws when mesh missing', () => {
    manager.attach({ ...refs, flash: null });
    expect(() => manager.getMesh('flash')).toThrow();
  });

  it('returns snapshot copies', () => {
    manager.attach(refs);
    manager.beginFrame();
    manager.commit('fireball', { count: 1, saturated: false });
    const snapshot = manager.snapshotCounts();
    expect(snapshot.fireball).toBe(1);
    manager.commit('fireball', { count: 1, saturated: false });
    expect(snapshot.fireball).toBe(1);
  });

  it('respects attach readiness', () => {
    const incomplete: InstancedMeshRefs = { ...refs, plasma: null };
    expect(manager.attach(incomplete)).toBe(false);
  });

  afterEach(() => {
    Object.values(refs).forEach((mesh) => {
      if (mesh) {
        mesh.geometry.dispose();
        (mesh.material as MeshBasicMaterial).dispose();
      }
    });
  });
});
