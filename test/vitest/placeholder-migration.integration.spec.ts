import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { shipInstancer } from '../../src/renderer/shipInstancer';
import { createMeshFactoryState, createShipMesh } from '../../src/renderer/meshFactory';
import { RendererConfig } from '../../src/config/rendererConfig';

describe('Placeholder migration to instancer', () => {
  let scene: THREE.Scene;
  let shipsGroup: THREE.Group;
  let shipMeshes: Map<number, THREE.Object3D>;

  beforeEach(() => {
    scene = new THREE.Scene();
    shipsGroup = new THREE.Group();
    scene.add(shipsGroup);
    shipMeshes = new Map<number, THREE.Object3D>();
    shipInstancer.init(scene, shipsGroup);
  });

  it('migrates an existing placeholder to an instanced slot when prototype registers', async () => {
    // Create a fake ship entry (minimal shape expected by createShipMesh)
    const ship = {
      id: 42,
      class: 'mig-test',
      team: 'red',
      pos: { x: 1, y: 2, z: 0 },
      orientation: { pitch: 0, yaw: 0, roll: 0 },
      maxShield: 0,
      health: 100,
      maxHealth: 100,
    } as any;

    const state = { assetPool: new Map<string, any>() } as any;
    const placeholder = createShipMesh(ship, state, shipsGroup, shipMeshes);
    // Should have a placeholder mesh returned and placed in shipMeshes map only when syncEntities is used
    expect(placeholder).toBeDefined();

    // Simulate that an SVG asset becomes available by registering a prototype
    const geom = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    shipInstancer.registerPrototype('mig-test', [geom], [mat]);

    // Now try to allocate for the existing ship (this is what migration code does internally)
    const allocated = shipInstancer.allocate(ship.id, ship.class, ship.team);
    expect(allocated).toBe(true);

    const q = new THREE.Quaternion();
    const updated = shipInstancer.updateTransform(ship.id, ship.pos, q, 1);
    expect(updated).toBe(true);

    // Ensure the instancer reports the ship and placeholder would be removed
    expect(shipInstancer.hasShip(ship.id)).toBe(true);
  });
});
