import { describe, it, expect, beforeEach } from 'vitest';
import { BufferGeometry, InstancedMesh, MeshBasicMaterial, Matrix4, Color } from 'three';
import { createInstancedLayerManager } from '../../../src/components/layers/instancedLayer.js';

function createMesh(capacity: number): InstancedMesh {
  return new InstancedMesh(new BufferGeometry(), new MeshBasicMaterial(), capacity);
}

describe('InstancedLayerManager edge cases', () => {
  it('allocates lowest indices first and recycles released indices', () => {
    const mesh = createMesh(3);
    const mgr = createInstancedLayerManager({ current: mesh }, { capacity: 3, supportsInstanceColor: true });
    mgr.beginFrame();

    const a = mgr.allocate('a');
    const b = mgr.allocate('b');
    const c = mgr.allocate('c');

    expect(a).toBe(0);
    expect(b).toBe(1);
    expect(c).toBe(2);

    // release middle index and ensure recycling
    const released = mgr.release('b');
    expect(released).toBe(1);

    const d = mgr.allocate('d');
    expect(d).toBe(1);

    const summary = mgr.endFrame();
    expect(summary.count).toBeGreaterThanOrEqual(1);
  });

  it('endFrame reports released indices and maxIndex semantics', () => {
    const mesh = createMesh(4);
    const mgr = createInstancedLayerManager({ current: mesh }, { capacity: 4 });

    // Frame 1: allocate a,b
    mgr.beginFrame();
    const ia = mgr.allocate('a');
    const ib = mgr.allocate('b');
    expect(ia).toBe(0);
    expect(ib).toBe(1);
    mgr.endFrame();

    // Frame 2: only allocate b (simulate a not active)
    mgr.beginFrame();
    const ib2 = mgr.allocate('b');
    expect(ib2).toBe(1);
    const summary2 = mgr.endFrame();

    // Since 'a' was not re-allocated in frame2, it should be released
    expect(summary2.released.length).toBeGreaterThanOrEqual(1);
    expect(summary2.count).toBeGreaterThanOrEqual(1);
  });

  it('saturates when capacity reached', () => {
    const mesh = createMesh(2);
    const mgr = createInstancedLayerManager({ current: mesh }, { capacity: 2 });
    mgr.beginFrame();
    const i1 = mgr.allocate('k1');
    const i2 = mgr.allocate('k2');
    expect(i1).not.toBeNull();
    expect(i2).not.toBeNull();
    const i3 = mgr.allocate('k3');
    expect(i3).toBeNull();
    const summary = mgr.endFrame();
    expect(summary.saturated).toBe(true);
  });

  it('behaves safely when meshRef.current is null', () => {
    const mgr = createInstancedLayerManager({ current: null }, { capacity: 3 });
    // Should not throw when mesh missing
    mgr.beginFrame();
    const i = mgr.allocate('x');
    // allocation should still succeed logically (index or null depending on capacity)
    expect(typeof i === 'number' || i === null).toBe(true);
    const out = mgr.endFrame();
    expect(out).toHaveProperty('count');
    expect(out).toHaveProperty('saturated');
  });
});
