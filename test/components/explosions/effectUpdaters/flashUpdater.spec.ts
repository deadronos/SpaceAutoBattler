import { describe, it, expect, beforeEach } from 'vitest';
import {
  Camera,
  Color,
  InstancedMesh,
  Object3D,
  Quaternion,
  Vector3,
  SphereGeometry,
  MeshBasicMaterial,
} from 'three';
import { updateFlash } from '../../../../src/components/explosions/effectUpdaters/flashUpdater.js';
import { createInstancedLayerManager } from '../../../../src/components/layers/instancedLayer.js';
import type { EffectUpdateContext } from '../../../../src/components/explosions/effectUpdaters/types.js';
import type { ExplosionEvent } from '../../../../src/types/index.js';
import { SeededRng } from '../../../../src/utils/rng.js';
import { getDerived } from '../../../../src/components/explosions/derived.js';

describe('flashUpdater', () => {
  let ctx: EffectUpdateContext;
  let mesh: InstancedMesh;
  let event: ExplosionEvent;
  let camera: Camera;

  beforeEach(() => {
    camera = new Camera();
    camera.position.set(0, 0, 10);
    camera.quaternion.identity();

    event = {
      id: 1,
      seed: 42,
      faction: 'alliance',
      hull: 'fighter',
      position: new Vector3(0, 0, 0),
      radius: 2,
      startTime: 0,
      duration: 1,
      lightDuration: 0.5,
      lightFalloff: 2,
      lightColor: '#ffffff',
      flashIntensity: 1.5,
      shockwave: { delay: 0.1, duration: 0.4, maxRadius: 3 },
      fireball: { delay: 0.05, duration: 0.6 },
      debris: { count: 10, speed: [1, 3] },
      particles: { sparks: 20, plasma: 15, smoke: 18 },
      palette: {
        flash: '#ffaa55',
        shockwave: '#ff8844',
        fireballHot: '#ff6633',
        smoke: '#444444',
      },
      elapsed: 0.05,
      lightElapsed: 0.05,
    };

    const derived = getDerived(event);

    ctx = {
      event,
      time: 0.05,
      camera,
      derived,
      dummy: new Object3D(),
      tmpQuat: new Quaternion(),
      tmpVec: new Vector3(),
      color: new Color(),
    };

    mesh = new InstancedMesh(new SphereGeometry(1), new MeshBasicMaterial(), 10);
  });

  it('should create flash instance when within flash duration', () => {
    const mgr = createInstancedLayerManager(
      { current: mesh },
      { capacity: 10, supportsInstanceColor: true },
    );
    mgr.beginFrame();
    const result = updateFlash(ctx, mgr, String(event.id));
    expect(result.count).toBe(1);
    expect(result.saturated).toBe(false);
  });

  it('should not create flash instance when time exceeds flash duration', () => {
    ctx.time = 0.15;
    const mgr = createInstancedLayerManager(
      { current: mesh },
      { capacity: 10, supportsInstanceColor: true },
    );
    mgr.beginFrame();
    const result = updateFlash(ctx, mgr, String(event.id));
    expect(result.count).toBe(0);
    expect(result.saturated).toBe(false);
  });

  it('should set correct matrix and color for flash instance', () => {
    const mgr = createInstancedLayerManager(
      { current: mesh },
      { capacity: 10, supportsInstanceColor: true },
    );
    mgr.beginFrame();
    updateFlash(ctx, mgr, String(event.id));

    const matrix = mesh.instanceMatrix.array;
    expect(matrix).toBeDefined();

    const color = new Color();
    mesh.getColorAt(0, color);
    expect(color.r).toBeGreaterThan(0);
  });

  it('should scale flash based on progress', () => {
    ctx.time = 0.01;
    const mgr = createInstancedLayerManager(
      { current: mesh },
      { capacity: 10, supportsInstanceColor: true },
    );
    mgr.beginFrame();
    updateFlash(ctx, mgr, `${event.id}:t1`);
    const dummy1 = new Object3D();
    mesh.getMatrixAt(0, dummy1.matrix);
    dummy1.matrix.decompose(dummy1.position, dummy1.quaternion, dummy1.scale);
    const scale1 = dummy1.scale.x;

    ctx.time = 0.1;
    updateFlash(ctx, mgr, `${event.id}:t2`);
    const dummy2 = new Object3D();
    mesh.getMatrixAt(1, dummy2.matrix);
    dummy2.matrix.decompose(dummy2.position, dummy2.quaternion, dummy2.scale);
    const scale2 = dummy2.scale.x;

    // Flash grows as it fades (easeOutQuad on 1-t), so later time should have smaller scale
    expect(scale1).toBeGreaterThan(scale2);
  });

  it('should be deterministic with same seed', () => {
    const mgr1 = createInstancedLayerManager(
      { current: mesh },
      { capacity: 10, supportsInstanceColor: true },
    );
    mgr1.beginFrame();
    const result1 = updateFlash(ctx, mgr1, String(event.id));
    const color1 = new Color();
    mesh.getColorAt(0, color1);

    const ctx2 = { ...ctx, event: { ...event } };
    const mesh2 = new InstancedMesh(new SphereGeometry(1), new MeshBasicMaterial(), 10);
    const mgr2 = createInstancedLayerManager(
      { current: mesh2 },
      { capacity: 10, supportsInstanceColor: true },
    );
    mgr2.beginFrame();
    const result2 = updateFlash(ctx2, mgr2, String(event.id));
    const color2 = new Color();
    mesh2.getColorAt(0, color2);

    expect(result1.count).toBe(result2.count);
    expect(result1.saturated).toBe(result2.saturated);
    expect(color1.r).toBeCloseTo(color2.r, 5);
    expect(color1.g).toBeCloseTo(color2.g, 5);
    expect(color1.b).toBeCloseTo(color2.b, 5);
  });

  it('reports saturation when start index exceeds capacity', () => {
    const mgr = createInstancedLayerManager(
      { current: mesh },
      { capacity: 10, supportsInstanceColor: true },
    );
    mgr.beginFrame();
    // Fill the allocator to force saturation
    for (let i = 0; i < 10; i += 1) {
      mgr.allocate(`${event.id}:fill:${i}` as any);
    }
    const result = updateFlash(ctx, mgr, String(event.id) + ':overflow');
    expect(result.count).toBe(0);
    expect(result.saturated).toBe(true);
  });
});
