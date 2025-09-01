import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { HealthBarInstancer } from '../../src/renderer/healthBarInstancer';

describe('HealthBarInstancer basic behavior', () => {
  it('allocates and updates an instance (matrices not zero-scale)', () => {
    const scene = new THREE.Scene();
    const group = new THREE.Group();
    scene.add(group);

    const instancer = new HealthBarInstancer(scene, group);

    const ship = {
      id: 123,
      pos: { x: 10, y: 20, z: 5 },
      health: 80,
      maxHealth: 100,
      shield: 50,
      maxShield: 100,
    } as any;

    const allocated = instancer.allocateInstance(ship.id);
    expect(allocated).toBe(true);

    // Update health bar and then check underlying instanced mesh matrices
    instancer.updateHealthBar(ship as any);
    instancer.markMatricesNeedUpdate();

  // Find health layer instanced mesh and the allocated instance index
  const healthMesh = (instancer as any).instancedMeshes.get('health') as THREE.InstancedMesh;
  expect(healthMesh).toBeDefined();

  const instanceIndex = (instancer as any).activeShips.get(ship.id);
  expect(typeof instanceIndex).toBe('number');

  const mat = new THREE.Matrix4();
  healthMesh.getMatrixAt(instanceIndex, mat);
    // Decompose and ensure scale.x is > 0 (not zero-scale hidden)
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    mat.decompose(pos, quat, scale);
    expect(scale.x).toBeGreaterThan(0);
  });
});
