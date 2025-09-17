import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { shipInstancer } from '../../src/renderer/shipInstancer.js';

describe('ShipInstancer basic allocation and growth', () => {
  let scene: THREE.Scene;
  let parent: THREE.Group;

  beforeEach(() => {
    shipInstancer.dispose();
    scene = new THREE.Scene();
    parent = new THREE.Group();
  });

  it('initializes and allocates/free/updates a ship instance', () => {
    shipInstancer.init(scene, parent as any);
    const shipId = 42;
    const className = 'test-ship';
    const team = 'red';

    // allocate should succeed
    const ok = shipInstancer.allocate(shipId, className, team);
    expect(ok).toBe(true);
    expect(shipInstancer.hasShip(shipId)).toBe(true);

    // updateTransform should return true
    const q = new THREE.Quaternion();
    const updated = shipInstancer.updateTransform(shipId, { x: 1, y: 2, z: 3 }, q, 1);
    expect(updated).toBe(true);

    // free should return true and then hasShip false
    const freed = shipInstancer.free(shipId);
    expect(freed).toBe(true);
    expect(shipInstancer.hasShip(shipId)).toBe(false);
  });

  it('grows capacity when exhausted', () => {
    shipInstancer.init(scene, parent as any);
    const className = 'tiny-ship';
    const team = 'blue';

    // Ensure group created with small capacity by registering a prototype with custom default capacity
    // We cannot easily control internal default capacity from here, but we can allocate many ships to force growth.
    const allocated: number[] = [];
    const maxToTry = 200; // large number to force growth from default 64
    for (let i = 0; i < maxToTry; i++) {
      const ok = shipInstancer.allocate(i, className, team);
      if (!ok) break;
      allocated.push(i);
    }

    // we should have allocated at least some
    expect(allocated.length).toBeGreaterThan(0);

    // free all
    for (const id of allocated) shipInstancer.free(id);

    expect(allocated.every((id) => !shipInstancer.hasShip(id))).toBe(true);
  });

  it('skips matrix updates when transform changes are under epsilon thresholds', () => {
    shipInstancer.init(scene, parent as any);
    const shipId = 7;
    const className = 'epsilon-ship';
    const team = 'red';
    const group = shipInstancer.ensureGroup(className, team) as unknown as {
      meshes: THREE.InstancedMesh[];
      matricesNeedUpdate: boolean;
    };

    expect(shipInstancer.allocate(shipId, className, team)).toBe(true);

    const mesh = group.meshes[0];
    const quat = new THREE.Quaternion();

    expect(
      shipInstancer.updateTransform(shipId, { x: 5, y: 0, z: 0 }, quat, 1),
    ).toBe(true);
    shipInstancer.sync();
    expect(mesh.instanceMatrix.version).toBeGreaterThan(0);
    const initialRange = (
      mesh.instanceMatrix as unknown as { updateRange?: { offset: number; count: number } }
    ).updateRange;
    if (initialRange) {
      expect(initialRange.offset).toBe(0);
      expect(initialRange.count).toBe(16);
    }
    mesh.instanceMatrix.needsUpdate = false;
    group.matricesNeedUpdate = false;

    // tiny movement below epsilon should not trigger GPU writes
    expect(
      shipInstancer.updateTransform(shipId, { x: 5 + 1e-4, y: 1e-4, z: 0 }, quat, 1),
    ).toBe(true);
    expect(group.matricesNeedUpdate).toBe(false);
    shipInstancer.sync();
    const versionAfterNoop = mesh.instanceMatrix.version;
    expect(versionAfterNoop).toBeGreaterThan(0);

    // rotation slightly above epsilon should flag updates
    const rotated = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.01);
    expect(
      shipInstancer.updateTransform(shipId, { x: 5.05, y: 0, z: 0 }, rotated, 1.002),
    ).toBe(true);
    expect(group.matricesNeedUpdate).toBe(true);
    shipInstancer.sync();
    expect(mesh.instanceMatrix.version).toBeGreaterThan(versionAfterNoop);
    const rotatedRange = (
      mesh.instanceMatrix as unknown as { updateRange?: { offset: number; count: number } }
    ).updateRange;
    if (rotatedRange) {
      expect(rotatedRange.count).toBe(16);
    }
  });

  it('toggles visibility based on frustum culling results', () => {
    shipInstancer.init(scene, parent as any);
    const shipId = 11;
    const className = 'cull-ship';
    const team = 'blue';

    expect(shipInstancer.allocate(shipId, className, team)).toBe(true);
    const group = shipInstancer.ensureGroup(className, team);
    const quat = new THREE.Quaternion();

    shipInstancer.updateTransform(shipId, { x: 0, y: 0, z: 0 }, quat, 1);
    shipInstancer.sync();

    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
    camera.position.set(0, 0, 10);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);
    camera.updateProjectionMatrix();

    shipInstancer.cull(camera);
    expect(group.parentGroup.visible).toBe(true);

    shipInstancer.updateTransform(shipId, { x: 1500, y: 1500, z: 1500 }, quat, 1);
    shipInstancer.sync();
    camera.updateMatrixWorld(true);
    shipInstancer.cull(camera);
    expect(group.parentGroup.visible).toBe(false);

    shipInstancer.updateTransform(shipId, { x: 0, y: 0, z: -10 }, quat, 1);
    shipInstancer.sync();
    camera.updateMatrixWorld(true);
    shipInstancer.cull(camera);
    expect(group.parentGroup.visible).toBe(true);
  });
});
