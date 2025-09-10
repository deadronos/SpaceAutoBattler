import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { shipInstancer } from '../../src/renderer/shipInstancer';

// Integration-style tests for prototype registration and sync

describe('ShipInstancer integration: prototype registration and sync', () => {
  let scene: THREE.Scene;
  let parent: THREE.Group;

  beforeEach(() => {
    scene = new THREE.Scene();
    parent = new THREE.Group();
  });

  it('registers a prototype, allocates many instances to force growth, updates transforms and syncs', () => {
    shipInstancer.init(scene, parent as any);

    // Create simple geometries and materials to register as the prototype
    const geom1 = new THREE.BoxGeometry(1, 1, 1);
    const geom2 = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const mat1 = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const mat2 = new THREE.MeshBasicMaterial({ color: 0x00ff00 });

    // Register prototype for class 'integration-test-ship'
    shipInstancer.registerPrototype('integration-test-ship', [geom1, geom2], [mat1, mat2]);

    // Allocate many ships to exceed default capacity (defaultCapacity=64 in implementation)
    const allocated: number[] = [];
    const target = 180; // force at least a couple growths
    for (let i = 0; i < target; i++) {
      const ok = shipInstancer.allocate(
        1000 + i,
        'integration-test-ship',
        i % 2 === 0 ? 'red' : 'blue',
      );
      if (!ok) break;
      allocated.push(1000 + i);
    }

    expect(allocated.length).toBeGreaterThan(64);

    // Update transforms for all allocated
    const q = new THREE.Quaternion();
    for (const id of allocated) {
      const updated = shipInstancer.updateTransform(
        id,
        { x: id % 10, y: (id % 7) * 0.5, z: (id % 5) * 0.25 },
        q,
        1,
      );
      expect(updated).toBe(true);
    }

    // Call markMatricesNeedUpdate and sync; ensure no exceptions and matrices updated flag cleared
    shipInstancer.markMatricesNeedUpdate();
    // calling sync should not throw
    expect(() => shipInstancer.sync()).not.toThrow();

    // Free half of them and ensure free works
    for (let i = 0; i < allocated.length; i += 2) {
      const freed = shipInstancer.free(allocated[i]);
      expect(freed).toBe(true);
    }

    // Remaining should still be present
    const remaining = allocated.filter((id, idx) => idx % 2 === 1);
    for (const id of remaining) expect(shipInstancer.hasShip(id)).toBe(true);

    // Free rest
    for (const id of remaining) shipInstancer.free(id);
    for (const id of allocated) expect(shipInstancer.hasShip(id)).toBe(false);
  });
});
