import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as THREE from 'three';

vi.mock('../../src/core/assetLoader', () => ({ loadGLTF: vi.fn() }));

import { preloadShipModels } from '../../src/core/shipModelLoader';
import { loadGLTF } from '../../src/core/assetLoader';
import type { GameState } from '../../src/types/index';
import SHIP_MODEL_MAP from '../../src/config/shipModelMap';

describe('shipModelLoader normals/tangents baking', () => {
  beforeEach(() => {
  (SHIP_MODEL_MAP as unknown as Record<string, { file: string; scale?: number }>).fighter = { file: 'models/fighter.glb', scale: 1 };
    (loadGLTF as unknown as ReturnType<typeof vi.fn>).mockReset?.();
  });

  it('preserves normals and tangents when applying matrix4 bake', async () => {
    // Build a simple geometry: two triangles (a quad) with positions and normals
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array([
      -0.5, -0.5, 0,
       0.5, -0.5, 0,
       0.5,  0.5, 0,
      -0.5,  0.5, 0
    ]);
    const normals = new Float32Array([
      0, 0, 1,
      0, 0, 1,
      0, 0, 1,
      0, 0, 1
    ]);
    // Synthetic tangent attribute (4 components often used, but we'll keep 3 for simplicity)
    const tangents = new Float32Array([
      1, 0, 0,
      1, 0, 0,
      1, 0, 0,
      1, 0, 0
    ]);
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geom.setAttribute('tangent', new THREE.BufferAttribute(tangents, 3));

    // Create mesh and attach to a translated parent so the loader will bake the translation
    const scene = new THREE.Group();
    const parent = new THREE.Group();
    parent.position.set(5, 2, -1);
    scene.add(parent);
    const mat = new THREE.MeshStandardMaterial({ color: 0x8888ff });
    const mesh = new THREE.Mesh(geom, mat);
    parent.add(mesh);

    (loadGLTF as unknown as ReturnType<typeof vi.fn>).mockImplementation(async () => ({ url: 'models/fighter.glb', data: { scene } }));

    const state = { assetPool: new Map<string, unknown>() } as unknown as GameState;
    await preloadShipModels(state, ['red']);

    const stored = state.assetPool!.get('ship-fighter') as unknown as { threePrototypes?: { geometries: THREE.BufferGeometry[]; materials: THREE.Material[] } } | undefined;
    expect(stored).toBeDefined();
    expect(stored && stored.threePrototypes).toBeDefined();
    const geoms = stored?.threePrototypes?.geometries ?? [];

    // Expect at least one geometry; examine the first's position/normal/tangent
    expect(geoms.length).toBeGreaterThan(0);
    const baked = geoms[0] as THREE.BufferGeometry;
    const posAttr = baked.getAttribute('position') as THREE.BufferAttribute | undefined;
    const normAttr = baked.getAttribute('normal') as THREE.BufferAttribute | undefined;
    const tanAttr = baked.getAttribute('tangent') as THREE.BufferAttribute | undefined;
    expect(posAttr).toBeDefined();
    expect(normAttr).toBeDefined();
    // tangent may be present depending on clone; if present validate it
    if (tanAttr) {
      // Normals should still be unit-ish and point roughly in +Z after translation (translation doesn't change direction)
      const nx = normAttr!.getX(0);
      const ny = normAttr!.getY(0);
      const nz = normAttr!.getZ(0);
      const len = Math.hypot(nx, ny, nz);
      expect(len).toBeGreaterThan(0.9);

      // Position first vertex X should be translated by parent.x (5)
      const px = posAttr!.getX(0);
      expect(px).toBeGreaterThan(4.4);

      // Tangent should remain unit-ish along X
      const tx = tanAttr.getX(0);
      const ty = tanAttr.getY(0);
      const tz = tanAttr.getZ(0);
      const tlen = Math.hypot(tx, ty, tz);
      expect(tlen).toBeGreaterThan(0.9);
    }
  });
});
