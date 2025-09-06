import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as THREE from 'three';

// We'll import the module under test after mocking
vi.mock('../../src/core/assetLoader', () => ({ loadGLTF: vi.fn() }));

import { preloadShipModels } from '../../src/core/shipModelLoader';
import type { GameState } from '../../src/types/index';
import { loadGLTF } from '../../src/core/assetLoader';
import SHIP_MODEL_MAP from '../../src/config/shipModelMap';
import { shipInstancer } from '../../src/renderer/shipInstancer';

describe('shipModelLoader threePrototypes extraction', () => {
  beforeEach(() => {
    // Ensure a stable entry for at least one class
  (SHIP_MODEL_MAP as unknown as Record<string, { file: string; scale?: number; pivotOffset?: [number, number, number]; boundsRadius?: number; attribution?: string }>).fighter = { file: 'models/fighter.glb', scale: 1, pivotOffset: [0,0,0], boundsRadius: 1, attribution: '' };
    // Clear mocks
    (loadGLTF as unknown as ReturnType<typeof vi.fn>).mockReset?.();
  });

  it('extracts geometries and materials, honoring nested transforms and multi-material meshes', async () => {
  // Construct a fake glTF scene: a parent Group with a translation, and a Mesh child with two materials
  const gltfScene = new THREE.Group();
  const gltfParent = new THREE.Group();
  gltfParent.position.set(10, 0, 0); // nested transform to bake
  gltfScene.add(gltfParent);

    const geom = new THREE.BoxGeometry(1,1,1);
    // Create two simple materials to simulate multi-material mesh
    const matA = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const matB = new THREE.MeshBasicMaterial({ color: 0x00ff00 });

    // Create a mesh with an array of materials (multi-material). Three will use groups, but for our extraction
    // we just need a Mesh with material array to be detected.
    const multiMatMesh = new THREE.Mesh(geom, [matA, matB]);
  // attach the mesh under parent so its world matrix includes parent's translation
  gltfParent.add(multiMatMesh);

    // Mock loadGLTF to return this scene inside .scene
    (loadGLTF as unknown as ReturnType<typeof vi.fn>).mockImplementation(async (_state: unknown, _url: string) => {
      return { url: 'models/fighter.glb', data: { scene: gltfScene } };
    });

  const state = { assetPool: new Map<string, unknown>() } as unknown as GameState;
  // Ensure a fresh test by not relying on prototype registration side-effects

  await preloadShipModels(state, ['red']);
  // Note: registerPrototypesFromPool only registers SVG-derived prototypes.
  // For glTF-based threePrototypes the instancer registers prototypes lazily during allocate().
  // Call allocate() and assert it returns true and that instancer stats include the new group.

    // Validate assetPool entries
  expect(state.assetPool).toBeDefined();
  const stored = state.assetPool!.get('ship-fighter') as unknown as { threePrototypes?: { geometries: THREE.BufferGeometry[]; materials: THREE.Material[] } } | undefined;
  expect(stored).toBeDefined();
  expect(stored && stored.threePrototypes).toBeDefined();
  const geoms = stored && stored.threePrototypes ? (stored.threePrototypes.geometries as THREE.BufferGeometry[]) : [];
  const mats = stored && stored.threePrototypes ? (stored.threePrototypes.materials as THREE.Material[]) : [];

    // Because the mesh had two materials, we expect two geometries and two materials extracted
    expect(geoms.length).toBeGreaterThanOrEqual(2);
    expect(mats.length).toBeGreaterThanOrEqual(2);

    // Check that geometries have been transformed (baked) by verifying one vertex x is offset by parent position (10)
    const posAttr = geoms[0].getAttribute('position') as THREE.BufferAttribute | undefined;
    expect(posAttr).toBeDefined();
    if (posAttr) {
      const firstX = posAttr.getX(0);
      // original box geometry first vertex x is around -0.5; after baking +10 should be > 9
      expect(firstX).toBeGreaterThan(9);
    }

  // Initialize shipInstancer with a scene/parent so allocate can operate in this headless test
  const scene = new THREE.Scene();
  const parent = new THREE.Group();
  scene.add(parent);
  shipInstancer.init(scene, parent);

  // Invoke allocate which should register a prototype from the glTF proto and create the group
  let allocated = false;
  try { allocated = shipInstancer.allocate(12345, 'fighter', 'red', state); } catch { allocated = false; }
  expect(allocated).toBeTruthy();
  const stats = shipInstancer.getStats();
  // group key uses format `${class}_${team}`
  expect(stats.groups['fighter_red']).toBeDefined();
  expect(stats.groups['fighter_red'].used).toBeGreaterThanOrEqual(1);
  });
});
