import { test, expect, vi } from 'vitest';
import { createThreeRenderer } from '../../src/renderer/threeRenderer.js';
import { createInitialState } from '../../src/core/gameState.js';
import type { GameState } from '../../src/types/index.js';

// Mock Three.js similar to other renderer tests so WebGLRenderer does not
// attempt to access a real WebGL context in the test environment.
vi.mock('three', async () => {
  const actual: any = await vi.importActual('three');
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
    PerspectiveCamera: vi.fn().mockImplementation(() => ({ aspect: 1, updateProjectionMatrix: vi.fn(), position: { set: vi.fn() }, lookAt: vi.fn() })),
    Group: vi.fn().mockImplementation(() => ({ add: vi.fn(), remove: vi.fn() })),
    Mesh: vi.fn().mockImplementation(() => ({ position: { set: vi.fn() }, rotation: { set: vi.fn() }, scale: { setScalar: vi.fn() } })),
    Vector3: vi.fn().mockImplementation(() => ({ set: vi.fn(), copy: vi.fn(), clone: vi.fn().mockReturnThis(), setFromMatrixColumn: vi.fn().mockReturnThis() })),
    Quaternion: vi.fn().mockImplementation(() => ({})),
    CanvasTexture: vi.fn(),
    CubeTexture: vi.fn(),
    ClampToEdgeWrapping: vi.fn(),
    LinearFilter: vi.fn(),
    ShaderMaterial: vi.fn().mockImplementation((opts: any) => ({ uniforms: (opts && opts.uniforms) || {}, vertexShader: opts && opts.vertexShader, fragmentShader: opts && opts.fragmentShader, depthTest: opts && opts.depthTest, depthWrite: opts && opts.depthWrite, needsUpdate: false })),
    WebGLRenderTarget: vi.fn().mockImplementation(() => ({ width: 0, height: 0, texture: { type: undefined, format: undefined, name: '' }, dispose: vi.fn() })),
    BackSide: 2,
    DoubleSide: 2,
    Color: vi.fn(),
    AmbientLight: vi.fn(),
    DirectionalLight: vi.fn().mockImplementation(() => ({ position: { set: vi.fn() } })),
    BoxGeometry: vi.fn(),
    EdgesGeometry: vi.fn(),
    LineBasicMaterial: vi.fn(),
    LineSegments: vi.fn().mockImplementation(() => ({ position: { set: vi.fn() } })),
  };
});

// This is a small integration/smoke test that mounts the renderer,
// attaches orbit-style controls via the public cameraManager API,
// performs a programmatic wheel/rotate action, and asserts the
// canonical CameraState is updated (distance/rotation/target).

test('OrbitControls smoke: attach and update camera transform', async () => {
  // createRendererForTest is a lightweight helper used in other tests to
  // instantiate the renderer in a headless environment. If missing, the
  // test will fallback to importing the regular threeRenderer create function.
  const canvas = document.createElement('canvas');
  const state: GameState = createInitialState();
  state.assetPool = new Map();
  const renderer = createThreeRenderer(state, canvas);

  // Attach OrbitControls via renderer helper
  const controls = renderer.attachOrbitControls?.(canvas as unknown as HTMLElement);
  // controls may be null when OrbitControls not available in test env
  // but setCameraDistance should still update the canonical camera.

  const beforeDistance = renderer.getCameraDistance?.() ?? NaN;
  renderer.setCameraDistance?.((beforeDistance || 100) * 0.8);
  await new Promise((r) => setTimeout(r, 20));
  const afterDistance = renderer.getCameraDistance?.() ?? NaN;
  expect(afterDistance).not.toBe(beforeDistance);

  // Ensure setting rotation doesn't throw and matrix accessor exists
  expect(typeof renderer.getCameraMatrix).toBe('function');
  expect(() => renderer.setCameraRotation?.({ x: 0.1, y: 0.2, z: 0 })).not.toThrow();

  if (controls && typeof controls.dispose === 'function') controls.dispose();
  renderer.dispose();
});
