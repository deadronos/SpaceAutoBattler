import { describe, it, expect, beforeEach } from 'vitest';
import { Camera, Color, InstancedMesh, Object3D, Quaternion, Vector3, SphereGeometry, MeshBasicMaterial } from 'three';
import { updatePlasma } from '../../../../src/components/explosions/effectUpdaters/plasmaUpdater.js';
import type { EffectUpdateContext } from '../../../../src/components/explosions/effectUpdaters/types.js';
import type { ExplosionEvent } from '../../../../src/types/index.js';
import { getDerived } from '../../../../src/components/explosions/derived.js';

describe('plasmaUpdater', () => {
  let ctx: EffectUpdateContext;
  let mesh: InstancedMesh;
  let event: ExplosionEvent;

  beforeEach(() => {
    const camera = new Camera();

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
      elapsed: 0.4,
      lightElapsed: 0.4,
    };

    const derived = getDerived(event);

    ctx = {
      event,
      time: 0.4,
      camera,
      derived,
      dummy: new Object3D(),
      tmpQuat: new Quaternion(),
      tmpVec: new Vector3(),
      color: new Color(),
    };

    mesh = new InstancedMesh(new SphereGeometry(1), new MeshBasicMaterial(), 100);
  });

  it('should not create plasma before delay', () => {
    ctx.time = 0.1;
    const result = updatePlasma(ctx, mesh, 0, 100);
    expect(result.count).toBe(0);
    expect(result.saturated).toBe(false);
  });

  it('should create multiple plasma instances', () => {
    ctx.time = 0.4;
    const result = updatePlasma(ctx, mesh, 0, 100);
    expect(result.count).toBeGreaterThan(0);
    expect(result.count).toBeLessThanOrEqual(event.particles.plasma);
    expect(result.saturated).toBe(false);
  });

  it('should respect capacity limits', () => {
    ctx.time = 0.4;
    const result = updatePlasma(ctx, mesh, 0, 5);
    expect(result.count).toBeLessThanOrEqual(5);
  });

  it('should move plasma plumes outward', () => {
    ctx.time = 0.3;
    updatePlasma(ctx, mesh, 0, 100);
    const dummy1 = new Object3D();
    mesh.getMatrixAt(0, dummy1.matrix);
    dummy1.matrix.decompose(dummy1.position, dummy1.quaternion, dummy1.scale);
    const distance1 = dummy1.position.length();

    ctx.time = 0.6;
    updatePlasma(ctx, mesh, 0, 100);
    const dummy2 = new Object3D();
    mesh.getMatrixAt(0, dummy2.matrix);
    dummy2.matrix.decompose(dummy2.position, dummy2.quaternion, dummy2.scale);
    const distance2 = dummy2.position.length();

    expect(distance2).toBeGreaterThan(distance1);
  });

  it('should be deterministic with same seed', () => {
    const result1 = updatePlasma(ctx, mesh, 0, 100);

    const ctx2 = { ...ctx, event: { ...event } };
    ctx2.derived = getDerived(ctx2.event);
    const mesh2 = new InstancedMesh(new SphereGeometry(1), new MeshBasicMaterial(), 100);
    const result2 = updatePlasma(ctx2, mesh2, 0, 100);

    expect(result1.count).toBe(result2.count);
    expect(result1.saturated).toBe(result2.saturated);
  });

  it('flags saturation when plasma count exceeds capacity', () => {
    ctx.time = 0.4;
    const result = updatePlasma(ctx, mesh, 0, 1);
    expect(result.count).toBeLessThanOrEqual(1);
    expect(result.saturated).toBe(true);
  });
});
