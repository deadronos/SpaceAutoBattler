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
import { updateSmoke } from '../../../../src/components/explosions/effectUpdaters/smokeUpdater.js';
import { createInstancedLayerManager } from '../../../../src/components/layers/instancedLayer.js';
import type { EffectUpdateContext } from '../../../../src/components/explosions/effectUpdaters/types.js';
import type { ExplosionEvent } from '../../../../src/types/index.js';
import { getDerived } from '../../../../src/components/explosions/derived.js';

describe('smokeUpdater', () => {
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
      elapsed: 0.5,
      lightElapsed: 0.5,
    };

    const derived = getDerived(event);

    ctx = {
      event,
      time: 0.5,
      camera,
      derived,
      dummy: new Object3D(),
      tmpQuat: new Quaternion(),
      tmpVec: new Vector3(),
      color: new Color(),
    };

    mesh = new InstancedMesh(new SphereGeometry(1), new MeshBasicMaterial(), 100);
  });

  it('should not create smoke before delay', () => {
    ctx.time = 0.1;
    const mgr = createInstancedLayerManager({ current: mesh }, { capacity: 100, supportsInstanceColor: true });
    mgr.beginFrame();
    const result = updateSmoke(ctx, mgr, String(event.id));
    expect(result.count).toBe(0);
    expect(result.saturated).toBe(false);
  });

  it('should create multiple smoke instances', () => {
    ctx.time = 0.5;
    const mgr = createInstancedLayerManager({ current: mesh }, { capacity: 100, supportsInstanceColor: true });
    mgr.beginFrame();
    const result = updateSmoke(ctx, mgr, String(event.id));
    expect(result.count).toBeGreaterThan(0);
    expect(result.count).toBeLessThanOrEqual(event.particles.smoke);
    expect(result.saturated).toBe(false);
  });

  it('should respect capacity limits', () => {
    ctx.time = 0.5;
    const mgr = createInstancedLayerManager({ current: mesh }, { capacity: 5, supportsInstanceColor: true });
    mgr.beginFrame();
    const result = updateSmoke(ctx, mgr, String(event.id));
    expect(result.count).toBeLessThanOrEqual(5);
  });

  it('should drift smoke wisps over time', () => {
    ctx.time = 0.35;
    const mgr1 = createInstancedLayerManager({ current: mesh }, { capacity: 100, supportsInstanceColor: true });
    mgr1.beginFrame();
    updateSmoke(ctx, mgr1, String(event.id));
    const dummy1 = new Object3D();
    mesh.getMatrixAt(0, dummy1.matrix);
    dummy1.matrix.decompose(dummy1.position, dummy1.quaternion, dummy1.scale);
    const pos1 = dummy1.position.clone();

    ctx.time = 1.0;
    const mgr2 = createInstancedLayerManager({ current: mesh }, { capacity: 100, supportsInstanceColor: true });
    mgr2.beginFrame();
    updateSmoke(ctx, mgr2, String(event.id));
    const dummy2 = new Object3D();
    mesh.getMatrixAt(0, dummy2.matrix);
    dummy2.matrix.decompose(dummy2.position, dummy2.quaternion, dummy2.scale);
    const pos2 = dummy2.position.clone();

    const distance = pos1.distanceTo(pos2);
    expect(distance).toBeGreaterThan(0);
  });

  it('should fade smoke over time', () => {
    ctx.time = 0.35;
    const mgr3 = createInstancedLayerManager({ current: mesh }, { capacity: 100, supportsInstanceColor: true });
    mgr3.beginFrame();
    updateSmoke(ctx, mgr3, String(event.id));
    const color1 = new Color();
    mesh.getColorAt(0, color1);
    const intensity1 = color1.r + color1.g + color1.b;

    ctx.time = 1.5;
    const mgr4 = createInstancedLayerManager({ current: mesh }, { capacity: 100, supportsInstanceColor: true });
    mgr4.beginFrame();
    updateSmoke(ctx, mgr4, String(event.id));
    const color2 = new Color();
    mesh.getColorAt(0, color2);
    const intensity2 = color2.r + color2.g + color2.b;

    expect(intensity2).toBeLessThan(intensity1);
  });

  it('flags saturation when smoke exceeds capacity', () => {
    ctx.time = 0.5;
    const mgr = createInstancedLayerManager({ current: mesh }, { capacity: 1, supportsInstanceColor: true });
    mgr.beginFrame();
    const result = updateSmoke(ctx, mgr, String(event.id));
    expect(result.count).toBeLessThanOrEqual(1);
    expect(result.saturated).toBe(true);
  });
});
