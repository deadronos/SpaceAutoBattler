import { describe, expect, it } from 'vitest';
import {
  BufferGeometry,
  Color,
  InstancedMesh,
  MeshBasicMaterial,
  Object3D,
  Quaternion,
  Vector3,
} from 'three';
import { DebrisInstancedManager } from '../../../src/components/debris/DebrisInstancedManager.js';
import type { EffectUpdateContext } from '../../../src/components/explosions/effectUpdaters/types.js';

function createContext(): EffectUpdateContext {
  return {
    event: {
      id: 1,
      seed: 1,
      faction: 'alliance',
      hull: 'fighter',
      position: new Vector3(0, 0, 0),
      radius: 10,
      startTime: 0,
      duration: 1,
      lightDuration: 1,
      lightFalloff: 1,
      lightColor: '#ffffff',
      flashIntensity: 1,
      shockwave: { delay: 0, duration: 1, maxRadius: 5 },
      fireball: { delay: 0, duration: 1 },
      debris: { count: 3, speed: [1, 1] },
      particles: { sparks: 0, plasma: 0, smoke: 0 },
      palette: {
        flash: '#fff',
        shockwave: '#fff',
        fireballHot: '#ff8000',
        smoke: '#333333',
      },
      variant: undefined,
      elapsed: 0.5,
      lightElapsed: 0.5,
    },
    time: 0.5,
    camera: { quaternion: new Quaternion() } as any,
    derived: {
      debris: [
        {
          lifetime: 1,
          direction: new Vector3(1, 0, 0),
          axis: new Vector3(0, 1, 0),
          spin: 1,
          speed: 2,
          scale: 1,
        },
        {
          lifetime: 1,
          direction: new Vector3(0, 1, 0),
          axis: new Vector3(1, 0, 0),
          spin: 1,
          speed: 1.5,
          scale: 0.8,
        },
      ],
      flicker: 1,
      sparks: [],
      plasma: [],
      smoke: [],
    },
    dummy: new Object3D(),
    tmpQuat: new Quaternion(),
    tmpVec: new Vector3(),
    color: new Color(),
  };
}

function createMesh(capacity: number): InstancedMesh {
  const geometry = new BufferGeometry();
  const material = new MeshBasicMaterial();
  return new InstancedMesh(geometry, material, capacity);
}

describe('DebrisInstancedManager', () => {
  it('allocates shards until capacity is reached', () => {
    const manager = new DebrisInstancedManager();
    const ctx = createContext();
    const mesh = createMesh(2);

    const result = manager.update(ctx, mesh, 0, 2);
    expect(result.count).toBe(2);
    expect(result.saturated).toBe(false);
    expect(mesh.instanceColor).not.toBeNull();
  });

  it('reports saturation when capacity exceeded', () => {
    const manager = new DebrisInstancedManager();
    const ctx = createContext();
    const mesh = createMesh(1);

    const result = manager.update(ctx, mesh, 0, 1);
    expect(result.count).toBe(1);
    expect(result.saturated).toBe(true);
  });
});
