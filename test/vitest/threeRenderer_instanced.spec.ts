import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ThreeRenderer, computeShipMatrix } from '../../src/threeRenderer';

// Minimal stubs to avoid real WebGL context
class FakeInstancedMesh {
  instanceMatrix: any;
  count = 0;
  matrices: any[] = [];
  constructor(public geometry: any, public material: any, public capacity: number) {
    this.instanceMatrix = { setUsage: vi.fn(), needsUpdate: false };
  }
  setMatrixAt(i: number, m: any) {
    this.matrices[i] = m.clone ? m.clone() : m;
  }
  dispose() {}
}

class FakeMatrix4 {
  _m = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  compose() { return this; }
  clone() { const n = new FakeMatrix4(); n._m = this._m.slice(); return n; }
}

class FakeVec3 { constructor(public x=0, public y=0, public z=0){} }
class FakeQuat { constructor(public x=0, public y=0, public z=0, public w=1){} }

describe('ThreeRenderer instanced ships', () => {
  const realTHREE = (globalThis as any).THREE as any;
  const realRAF = (globalThis as any).requestAnimationFrame as any;
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    // Stub THREE minimally
  (globalThis as any).THREE = {
      WebGLRenderer: vi.fn().mockImplementation(() => ({
        setPixelRatio: vi.fn(),
        setSize: vi.fn(),
        render: vi.fn(),
        dispose: vi.fn(),
      })),
      Scene: vi.fn().mockImplementation(() => ({ add: vi.fn(), remove: vi.fn(), traverse: vi.fn(), background: null })),
      Color: vi.fn(),
      PerspectiveCamera: vi.fn().mockImplementation(() => ({ position: { set: vi.fn() }, updateMatrixWorld: vi.fn(), lookAt: vi.fn(), aspect: 1, updateProjectionMatrix: vi.fn() })),
      AmbientLight: vi.fn(),
  DirectionalLight: vi.fn().mockImplementation(() => ({ position: { set: vi.fn().mockReturnValue({ normalize: vi.fn() }) } })),
      MeshStandardMaterial: vi.fn(),
      BoxGeometry: vi.fn(),
      InstancedMesh: FakeInstancedMesh,
      Matrix4: FakeMatrix4,
      Vector3: FakeVec3,
      Quaternion: FakeQuat,
      DynamicDrawUsage: 35048,
      Group: vi.fn().mockImplementation(() => ({ add: vi.fn() })),
      ExtrudeBufferGeometry: vi.fn(),
      Mesh: vi.fn(),
    };
  (globalThis as any).requestAnimationFrame = (cb: FrameRequestCallback) => { cb(0); return 1 as any; };
    canvas = document.createElement('canvas');
    canvas.width = 800; canvas.height = 600;
  });

  afterEach(() => {
    (globalThis as any).THREE = realTHREE;
  (globalThis as any).requestAnimationFrame = realRAF as any;
  });

  it('grows capacity and sets instance matrices from state', () => {
    const r = new ThreeRenderer(canvas);
    expect(r.init(canvas)).toBe(true);

    const state: any = {
      ships: Array.from({ length: 10 }, (_, i) => ({ id: String(i), x: i * 2, y: i, angle: 0 })),
    };

    r.renderState(state);
    const stats = r.getStats();
    expect(stats.instances).toBe(10);
    expect(stats.capacity).toBeGreaterThanOrEqual(10);

    // Render with more ships – capacity should grow
    state.ships = Array.from({ length: 100 }, (_, i) => ({ id: String(i), x: i, y: i, angle: 0 }));
    r.renderState(state);
    const stats2 = r.getStats();
    expect(stats2.instances).toBe(100);
    expect(stats2.capacity).toBeGreaterThanOrEqual(100);
  });

  it('computeShipMatrix handles 2D and 3D inputs', () => {
    const m = new (globalThis as any).THREE.Matrix4();
    const m2 = computeShipMatrix(m, { x: 1, y: 2, angle: Math.PI/2, scale: 2 });
    expect(m2).toBe(m);
    const m3 = computeShipMatrix(m, { position: { x: 0, y: 0, z: 5 }, quaternion: { x: 0, y: 0, z: 0, w: 1 }, scale: 1 });
    expect(m3).toBe(m);
  });
});
