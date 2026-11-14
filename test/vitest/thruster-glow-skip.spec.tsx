import { describe, it, expect, afterEach, vi } from 'vite-plus/test';
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { Group, Mesh, Quaternion, Vector3 } from 'three';
import type { ShipEntity } from '../../src/types/index.js';
import { isEngineMeshName, sceneHasEngineMeshes } from '../../src/hooks/useShipThrusters.js';
import { ThrusterInstancedManager } from '../../src/components/thrusters/ThrusterInstancedManager.js';
import type { GltfEngineHullMap } from '../../src/renderer/particles/useThrusterAnchors.js';

const frameCallbacks: Array<() => void> = [];
const allocatedKeys: number[] = [];

vi.mock('@react-three/fiber', () => ({
  useFrame: (callback: () => void) => {
    frameCallbacks.push(callback);
  },
}));

vi.mock('@react-three/drei', () => ({
  useGLTF: Object.assign(() => ({ scene: null }), { setDecoderPath: vi.fn() }),
}));

vi.mock('../../src/renderer/materialRegistry.js', () => ({
  getInstanceFriendlyMaterial: () => ({ material: { dispose: vi.fn() } }),
}));

vi.mock('../../src/components/layers/instancedLayer.js', () => ({
  InstancedLayerManager: class MockInstancedLayerManager {
    initMesh(): void {}
    dispose(): void {}
    beginFrame(): void {
      allocatedKeys.length = 0;
    }
    allocate(key: number): number {
      allocatedKeys.push(key);
      return allocatedKeys.length - 1;
    }
    setMatrixAt(): void {}
    setColorAt(): void {}
    endFrame() {
      return { saturated: false };
    }
  },
  createSaturationWarningState: () => ({ lastWarnFrame: -Infinity }),
  warnOnSaturation: vi.fn(),
}));

afterEach(() => {
  cleanup();
  frameCallbacks.length = 0;
  allocatedKeys.length = 0;
  vi.clearAllMocks();
});

function createShip(id: number, hull: 'fighter' | 'corvette'): ShipEntity {
  return {
    id,
    transform: {
      position: new Vector3(0, 0, 0),
      rotation: new Quaternion(),
      scale: 1,
    },
    ship: {
      team: 'blue',
      hull,
      velocity: new Vector3(),
    },
    model: hull,
    ai: { command: { thrust: 1 } },
  } as unknown as ShipEntity;
}

describe('ThrusterInstancedManager GLTF engine skip', () => {
  it('detects engine/thruster/exhaust mesh names accurately', () => {
    expect(isEngineMeshName('Main_Engine_L')).toBe(true);
    expect(isEngineMeshName('thrusterNozzle')).toBe(true);
    expect(isEngineMeshName('exhaust_port_01')).toBe(true);
    expect(isEngineMeshName('Cube.002')).toBe(false);

    const hullOnly = new Group();
    const hullMesh = new Mesh();
    hullMesh.name = 'Cube.002';
    hullOnly.add(hullMesh);
    expect(sceneHasEngineMeshes(hullOnly)).toBe(false);

    const withEngine = new Group();
    const engineMesh = new Mesh();
    engineMesh.name = 'Main_Thruster_01';
    withEngine.add(hullMesh.clone(), engineMesh);
    expect(sceneHasEngineMeshes(withEngine)).toBe(true);
  });

  it('skips fallback spheres for hulls with GLTF engine meshes and keeps hull-only ships', () => {
    const gltfEngineHulls: GltfEngineHullMap = new Map([
      ['fighter', true],
      ['corvette', false],
    ]);

    const fighterWithEngines = createShip(1, 'fighter');
    const corvetteWithoutEngines = createShip(2, 'corvette');

    render(
      <ThrusterInstancedManager
        ships={[fighterWithEngines, corvetteWithoutEngines]}
        gltfEngineHulls={gltfEngineHulls}
      />,
    );

    expect(frameCallbacks).toHaveLength(1);
    frameCallbacks[0]();

    // Ship 1 (fighter, key stride 1*6 = 6..) must be skipped; Ship 2 (corvette, keys 12, 13) allocated.
    expect(allocatedKeys).toEqual([12, 13]);
  });
});
