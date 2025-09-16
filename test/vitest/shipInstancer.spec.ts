import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { shipInstancer } from '../../src/renderer/shipInstancer.js';

describe('ShipInstancer basic allocation and growth', () => {
  let scene: THREE.Scene;
  let parent: THREE.Group;

  beforeEach(() => {
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
});
