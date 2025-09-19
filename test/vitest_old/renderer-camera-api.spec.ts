import { expect, test, vi } from 'vitest';

// Mock Three.js like other renderer tests so we don't require a real WebGL context
vi.mock('three', async () => {
  const actual: unknown = await vi.importActual('three');
  return {
    ...(actual || {}),
    WebGLRenderer: vi.fn().mockImplementation(() => ({
      setSize: vi.fn(),
      setPixelRatio: vi.fn(),
      render: vi.fn(),
      dispose: vi.fn(),
      domElement: { width: 800, height: 600 },
    })),
    Scene: vi.fn().mockImplementation(() => ({ add: vi.fn(), remove: vi.fn(), background: null })),
    PerspectiveCamera: vi.fn().mockImplementation(() => ({
      aspect: 1,
      updateProjectionMatrix: vi.fn(),
      position: { set: vi.fn() },
      lookAt: vi.fn(),
    })),
    Matrix4: vi.fn().mockImplementation(() => ({ compose: vi.fn(), makeScale: vi.fn() })),
    Vector3: vi.fn().mockImplementation(() => ({ set: vi.fn(), copy: vi.fn(), clone: vi.fn().mockReturnThis(), setFromMatrixColumn: vi.fn().mockReturnThis() })),
    Quaternion: vi.fn().mockImplementation(() => ({})),
    Mesh: vi.fn().mockImplementation(() => ({ position: { set: vi.fn() }, rotation: { set: vi.fn() }, scale: { setScalar: vi.fn() } })),
    InstancedMesh: vi.fn().mockImplementation(() => ({ setMatrixAt: vi.fn(), getMatrixAt: vi.fn(), instanceMatrix: { needsUpdate: false }, geometry: { dispose: vi.fn() }, material: { dispose: vi.fn() }, parent: null })),
  ShaderMaterial: vi.fn().mockImplementation((opts: unknown) => ({ uniforms: (opts && (opts as any).uniforms) || {}, vertexShader: (opts as any) && (opts as any).vertexShader, fragmentShader: (opts as any) && (opts as any).fragmentShader, depthTest: (opts as any) && (opts as any).depthTest, depthWrite: (opts as any) && (opts as any).depthWrite, needsUpdate: false })),
    WebGLRenderTarget: vi.fn().mockImplementation(() => ({ width: 0, height: 0, texture: { type: undefined, format: undefined, name: '' }, dispose: vi.fn() })),
    FloatType: 102,
    NearestFilter: 100,
    RGBAFormat: 101,
    UnsignedByteType: 103,
    BackSide: 2,
    DoubleSide: 2,
  };
});

import { createThreeRenderer } from '../../src/renderer/threeRenderer.js';
import type { GameState, RNG } from '../../src/types/index.js';

// Minimal fake GameState with required fields for renderer creation
const baseState = ((): GameState => {
  const rng: RNG = {
    seed: '0',
    next: () => 0.5,
    int: (min: number, _max: number) => min,
    pick: <T,>(arr: readonly T[]) => arr[0],
  };

  return {
    time: 0,
    tick: 0,
    running: false,
    speedMultiplier: 1,
    rng,
    nextId: 1,
    simConfig: {
      simBounds: { width: 1000, height: 1000, depth: 1000 },
      tickRate: 60,
      maxEntities: 1000,
      bulletLifetime: 10,
      maxSimulationSteps: 100,
      targetUpdateRate: 1,
      intentReevaluationRate: 1,
      boundaryBehavior: { ships: 'wrap', bullets: 'remove' },
      spatialGrid: { cellSize: 100 },
      seed: '0',
      useTimeBasedSeed: false,
    },
    ships: [],
    shipDataVersion: 0,
    bullets: [],
    score: { red: 0, blue: 0 },
  } as unknown as GameState;
})();

test('createThreeRenderer exposes camera helper methods', () => {
  // Use document when available (test environments provide it); otherwise a minimal stub
  const canvas = typeof document !== 'undefined' && document.createElement
    ? document.createElement('canvas')
    : ({} as HTMLCanvasElement);

  // Provide a permissive WebGLRenderingContext stub so Three.js doesn't crash
  const glStub = new Proxy(
    {},
    {
      get: () => {
        return () => {};
      },
    },
  );
  // Attach getContext that returns the stub for common context types
  try {
    // @ts-ignore - test helper: stub getContext for headless environments
    canvas.getContext = () => glStub;
  } catch {
    // ignore if canvas is read-only in some environments
  }

  const renderer = createThreeRenderer(baseState as GameState, canvas as HTMLCanvasElement);

  expect(typeof renderer.getCameraDistance).toBe('function');
  expect(typeof renderer.setCameraDistance).toBe('function');
  expect(typeof renderer.getCameraTarget).toBe('function');
  expect(typeof renderer.setCameraTarget).toBe('function');
  expect(typeof renderer.getCameraRotation).toBe('function');
  expect(typeof renderer.setCameraRotation).toBe('function');
  expect(typeof renderer.getCameraMatrix).toBe('function');
  expect(typeof renderer.attachOrbitControls).toBe('function');

  // Call each method to ensure they don't throw in the minimal test environment
  expect(() => renderer.getCameraDistance?.()).not.toThrow();
  expect(() => renderer.setCameraDistance?.(100)).not.toThrow();
  expect(() => renderer.getCameraTarget?.()).not.toThrow();
  expect(() => renderer.setCameraTarget?.({ x: 0, y: 0, z: 0 })).not.toThrow();
  expect(() => renderer.getCameraRotation?.()).not.toThrow();
  expect(() => renderer.setCameraRotation?.({ x: 0, y: 0, z: 0 })).not.toThrow();
  expect(() => renderer.getCameraMatrix?.()).not.toThrow();
  // attachOrbitControls may return null in some envs; ensure call is safe
  expect(() => renderer.attachOrbitControls?.(canvas as unknown as HTMLElement)).not.toThrow();

  // Dispose renderer to clean up any resources
  expect(() => renderer.dispose()).not.toThrow();
});
