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
import { updateShockwave } from '../../../../src/components/explosions/effectUpdaters/shockwaveUpdater.js';
import { createInstancedLayerManager } from '../../../../src/components/layers/instancedLayer.js';
import type { EffectUpdateContext } from '../../../../src/components/explosions/effectUpdaters/types.js';
import type { ExplosionEvent } from '../../../../src/types/index.js';
import { getDerived } from '../../../../src/components/explosions/derived.js';

describe('shockwaveUpdater', () => {
  let ctx: EffectUpdateContext;
  let mesh: InstancedMesh;
  let event: ExplosionEvent;

  beforeEach(() => {
    const camera = new Camera();
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
      elapsed: 0.2,
      lightElapsed: 0.2,
    };

    const derived = getDerived(event);

    ctx = {
      event,
      time: 0.2,
      camera,
      derived,
      dummy: new Object3D(),
      tmpQuat: new Quaternion(),
      tmpVec: new Vector3(),
      color: new Color(),
    };

    mesh = new InstancedMesh(new SphereGeometry(1), new MeshBasicMaterial(), 10);
  });

  it('should not create shockwave instance before delay', () => {
    ctx.time = 0.05;
    const mgr = createInstancedLayerManager({ current: mesh }, { capacity: 10, supportsInstanceColor: true });
    mgr.beginFrame();
    const result = updateShockwave(ctx, mgr, String(event.id));
    expect(result.count).toBe(0);
    expect(result.saturated).toBe(false);
  });

  it('should create shockwave instance after delay and within duration', () => {
    ctx.time = 0.2;
    const mgr = createInstancedLayerManager({ current: mesh }, { capacity: 10, supportsInstanceColor: true });
    mgr.beginFrame();
    const result = updateShockwave(ctx, mgr, String(event.id));
    expect(result.count).toBe(1);
    expect(result.saturated).toBe(false);
  });

  it('should not create shockwave instance after duration ends', () => {
    ctx.time = 0.6;
    const mgr = createInstancedLayerManager({ current: mesh }, { capacity: 10, supportsInstanceColor: true });
    mgr.beginFrame();
    const result = updateShockwave(ctx, mgr, String(event.id));
    expect(result.count).toBe(0);
    expect(result.saturated).toBe(false);
  });

  it('should expand shockwave radius over time', () => {
    ctx.time = 0.15;
    const mgr = createInstancedLayerManager({ current: mesh }, { capacity: 10, supportsInstanceColor: true });
    mgr.beginFrame();
    updateShockwave(ctx, mgr, String(event.id));
    const dummy1 = new Object3D();
    mesh.getMatrixAt(0, dummy1.matrix);
    dummy1.matrix.decompose(dummy1.position, dummy1.quaternion, dummy1.scale);
    const scale1 = dummy1.scale.x;

    ctx.time = 0.3;
    const mgr2 = createInstancedLayerManager({ current: mesh }, { capacity: 10, supportsInstanceColor: true });
    mgr2.beginFrame();
    updateShockwave(ctx, mgr2, String(event.id));
    const dummy2 = new Object3D();
    mesh.getMatrixAt(1, dummy2.matrix);
    dummy2.matrix.decompose(dummy2.position, dummy2.quaternion, dummy2.scale);
    const scale2 = dummy2.scale.x;

    expect(scale2).toBeGreaterThan(scale1);
  });

  it('should fade color as shockwave expands', () => {
    ctx.time = 0.15;
      const mgr1 = createInstancedLayerManager({ current: mesh }, { capacity: 10, supportsInstanceColor: true });
      mgr1.beginFrame();
      updateShockwave(ctx, mgr1, String(event.id));
    const color1 = new Color();
    mesh.getColorAt(0, color1);
    const intensity1 = color1.r + color1.g + color1.b;

    ctx.time = 0.4;
      const mgr2 = createInstancedLayerManager({ current: mesh }, { capacity: 10, supportsInstanceColor: true });
      mgr2.beginFrame();
      updateShockwave(ctx, mgr2, String(event.id));
    const color2 = new Color();
    mesh.getColorAt(1, color2);
    const intensity2 = color2.r + color2.g + color2.b;

    expect(intensity2).toBeLessThan(intensity1);
  });

  it('reports saturation when start index exceeds capacity', () => {
    const mgr = createInstancedLayerManager({ current: mesh }, { capacity: 10, supportsInstanceColor: true });
    mgr.beginFrame();
    // Fill allocator to force saturation
    for (let i = 0; i < 10; i += 1) {
      mgr.allocate(`${event.id}:fill:${i}` as any);
    }
    const result = updateShockwave(ctx, mgr, String(event.id) + ':overflow');
    expect(result.count).toBe(0);
    expect(result.saturated).toBe(true);
  });
});
