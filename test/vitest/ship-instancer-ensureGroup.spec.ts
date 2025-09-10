import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { shipInstancer } from '../../src/renderer/shipInstancer';

describe('shipInstancer.ensureGroup', () => {
  let scene: THREE.Scene;
  let parent: THREE.Group;

  beforeEach(() => {
    scene = new THREE.Scene();
    parent = new THREE.Group();
    // initialize fresh state
    try {
      shipInstancer.dispose();
    } catch {
      /* ignore */
    }
    shipInstancer.init(scene, parent);
  });

  it('creates separate groups for red and blue teams and names them correctly', () => {
    const gRed = shipInstancer.ensureGroup('fighter', 'red');
    const gBlue = shipInstancer.ensureGroup('fighter', 'blue');

    const stats = shipInstancer.getStats();
    expect(stats.groups).toHaveProperty('fighter_red');
    expect(stats.groups).toHaveProperty('fighter_blue');

    // verify parent group naming
    expect(gRed.parentGroup.name).toBe('ShipInstancer_fighter_red_group');
    expect(gBlue.parentGroup.name).toBe('ShipInstancer_fighter_blue_group');
  });
});
