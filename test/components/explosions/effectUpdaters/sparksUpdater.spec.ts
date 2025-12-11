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
import { updateSparks } from '../../../../src/components/explosions/effectUpdaters/sparksUpdater.js';
import { createInstancedLayerManager } from '../../../../src/components/layers/instancedLayer.js';
import type { EffectUpdateContext } from '../../../../src/components/explosions/effectUpdaters/types.js';
import type { ExplosionEvent } from '../../../../src/types/index.js';
import { getDerived } from '../../../../src/components/explosions/derived.js';

describe('sparksUpdater', () => {
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
      elapsed: 0.3,
      lightElapsed: 0.3,
    };

    const derived = getDerived(event);

    ctx = {
      event,
      time: 0.3,
      camera,
      derived,
      dummy: new Object3D(),
      tmpQuat: new Quaternion(),
      tmpVec: new Vector3(),
      color: new Color(),
    };

    mesh = new InstancedMesh(new SphereGeometry(1), new MeshBasicMaterial(), 100);
  });

  it('should not create sparks before delay', () => {
    ctx.time = 0.1;
    const mgr = createInstancedLayerManager(
      { current: mesh },
      { capacity: 100, supportsInstanceColor: true },
    );
    mgr.beginFrame();
    const result = updateSparks(ctx, mgr, String(event.id));
    expect(result.count).toBe(0);
    expect(result.saturated).toBe(false);
  });

  it('should create multiple spark instances', () => {
    ctx.time = 0.3;
    const mgr = createInstancedLayerManager(
      { current: mesh },
      { capacity: 100, supportsInstanceColor: true },
    );
    mgr.beginFrame();
    const result = updateSparks(ctx, mgr, String(event.id));
    expect(result.count).toBeGreaterThan(0);
    expect(result.count).toBeLessThanOrEqual(event.particles.sparks);
    expect(result.saturated).toBe(false);
  });

  it('should respect capacity limits', () => {
    ctx.time = 0.3;
    const mgr = createInstancedLayerManager(
      { current: mesh },
      { capacity: 5, supportsInstanceColor: true },
    );
    mgr.beginFrame();
    const result = updateSparks(ctx, mgr, String(event.id));
    expect(result.count).toBeLessThanOrEqual(5);
  });

  it('should face camera', () => {
    ctx.time = 0.3;
    const camera = ctx.camera;
    camera.quaternion.set(0.1, 0.2, 0.3, 0.9);
    camera.quaternion.normalize(); // Ensure valid quaternion

    const mgr = createInstancedLayerManager(
      { current: mesh },
      { capacity: 100, supportsInstanceColor: true },
    );
    mgr.beginFrame();
    updateSparks(ctx, mgr, String(event.id));

    const dummy = new Object3D();
    mesh.getMatrixAt(0, dummy.matrix);
    dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);

    // Sparks are camera-facing billboards, so quaternions should match closely
    expect(dummy.quaternion.x).toBeCloseTo(camera.quaternion.x, 2);
    expect(dummy.quaternion.y).toBeCloseTo(camera.quaternion.y, 2);
    expect(dummy.quaternion.z).toBeCloseTo(camera.quaternion.z, 2);
    expect(dummy.quaternion.w).toBeCloseTo(camera.quaternion.w, 2);
  });

  it('marks saturation when sparks exceed capacity', () => {
    ctx.time = 0.3;
    const mgr = createInstancedLayerManager(
      { current: mesh },
      { capacity: 1, supportsInstanceColor: true },
    );
    mgr.beginFrame();
    const result = updateSparks(ctx, mgr, String(event.id));
    expect(result.count).toBeLessThanOrEqual(1);
    expect(result.saturated).toBe(true);
  });
});
