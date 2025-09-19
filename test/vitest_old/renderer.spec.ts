import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createThreeRenderer } from '../../src/renderer/threeRenderer.js';
import { createInitialState } from '../../src/core/gameState.js';
import type { GameState } from '../../src/types/index.js';

// Mock Three.js and other dependencies but keep real exports where needed
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
    Scene: vi.fn().mockImplementation(() => ({
      add: vi.fn(),
      remove: vi.fn(),
      background: null,
    })),
    PerspectiveCamera: vi.fn().mockImplementation(() => ({
      aspect: 1,
      updateProjectionMatrix: vi.fn(),
      position: { set: vi.fn() },
      lookAt: vi.fn(),
    })),
    OrthographicCamera: vi.fn().mockImplementation(() => ({
      left: -1,
      right: 1,
      top: 1,
      bottom: -1,
      near: 0,
      far: 1,
      updateProjectionMatrix: vi.fn(),
    })),
    // keep PlaneGeometry and InstancedBufferAttribute from actual if available
    PlaneGeometry: actual && actual.PlaneGeometry ? actual.PlaneGeometry : vi.fn(),
    InstancedBufferAttribute:
      actual && actual.InstancedBufferAttribute ? actual.InstancedBufferAttribute : vi.fn(),
    // provide the other mocks we previously had
    Color: vi.fn(),
    AmbientLight: vi.fn(),
    DirectionalLight: vi.fn().mockImplementation(() => ({
      position: { set: vi.fn() },
    })),
    BoxGeometry: vi.fn(),
    EdgesGeometry: vi.fn(),
    LineBasicMaterial: vi.fn(),
    LineSegments: vi.fn().mockImplementation(() => ({
      position: { set: vi.fn() },
    })),
    Group: vi.fn().mockImplementation(() => ({
      add: vi.fn(),
      remove: vi.fn(),
    })),
    ConeGeometry: vi.fn(),
    MeshPhongMaterial: vi.fn(),
    Mesh: vi.fn().mockImplementation(() => ({
      position: { set: vi.fn() },
      rotation: { set: vi.fn() },
      scale: { setScalar: vi.fn() },
    })),
    SphereGeometry: vi.fn(),
    MeshBasicMaterial: vi.fn(),
    InstancedMesh: vi.fn().mockImplementation(() => ({
      setMatrixAt: vi.fn(),
      getMatrixAt: vi.fn(),
      instanceMatrix: { needsUpdate: false },
      geometry: { dispose: vi.fn() },
      material: { dispose: vi.fn() },
      parent: null,
    })),
    Matrix4: vi.fn().mockImplementation(() => ({
      compose: vi.fn(),
      makeScale: vi.fn(),
    })),
    Vector3: vi.fn().mockImplementation(() => ({
      set: vi.fn(),
      copy: vi.fn(),
      clone: vi.fn().mockReturnThis(),
      setFromMatrixColumn: vi.fn().mockReturnThis(),
    })),
    Quaternion: vi.fn().mockImplementation(() => ({})),
    CanvasTexture: vi.fn(),
    CubeTexture: vi.fn(),
    ClampToEdgeWrapping: vi.fn(),
    LinearFilter: vi.fn(),
    // ShaderMaterial and render target mocks used by effects.ts
    ShaderMaterial: vi.fn().mockImplementation((opts: any) => ({
      uniforms: (opts && opts.uniforms) || {},
      vertexShader: opts && opts.vertexShader,
      fragmentShader: opts && opts.fragmentShader,
      depthTest: opts && opts.depthTest,
      depthWrite: opts && opts.depthWrite,
      needsUpdate: false,
    })),
    WebGLRenderTarget: vi.fn().mockImplementation(() => ({
      width: 0,
      height: 0,
      texture: { type: undefined, format: undefined, name: '' },
      dispose: vi.fn(),
    })),
    // Numeric constants used by effects
    FloatType: 102,
    NearestFilter: 100,
    RGBAFormat: 101,
    UnsignedByteType: 103,
    // Add missing constants
    BackSide: 2,
    DoubleSide: 2,
  };
});

// Mock postprocessing
vi.mock('postprocessing', () => ({
  EffectComposer: vi.fn().mockImplementation(() => ({
    addPass: vi.fn(),
    render: vi.fn(),
    setSize: vi.fn(),
    dispose: vi.fn(),
  })),
  RenderPass: vi.fn(),
  EffectPass: vi.fn(),
  BloomEffect: vi.fn(),
  ToneMappingEffect: vi.fn(),
  MotionBlurEffect: vi.fn(),
  DepthOfFieldEffect: vi.fn(),
  SMAAEffect: vi.fn(),
}));

describe('Three.js Renderer', () => {
  let mockCanvas: HTMLCanvasElement;
  let state: GameState;

  beforeEach(() => {
    // Create mock canvas
    mockCanvas = {
      width: 800,
      height: 600,
      clientWidth: 800,
      clientHeight: 600,
      getContext: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as any;

    // Create initial state
    state = createInitialState();
    state.assetPool = new Map();
  });

  describe('resize function', () => {
    it('should handle resize with valid dimensions', () => {
      const renderer = createThreeRenderer(state, mockCanvas);

      // Mock window dimensions
      Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true });
      Object.defineProperty(window, 'innerHeight', { value: 768, writable: true });
      Object.defineProperty(window, 'devicePixelRatio', { value: 1, writable: true });

      // Call resize
      renderer.resize();

      // Verify canvas dimensions were set
      expect(mockCanvas.width).toBe(1024);
      expect(mockCanvas.height).toBe(768);
    });

    it('should prevent division by zero with zero dimensions', () => {
      const renderer = createThreeRenderer(state, mockCanvas);

      // Mock zero dimensions
      Object.defineProperty(window, 'innerWidth', { value: 0, writable: true });
      Object.defineProperty(window, 'innerHeight', { value: 100, writable: true });

      // Should not throw and should return early
      expect(() => renderer.resize()).not.toThrow();
    });

    it('should prevent division by zero with negative dimensions', () => {
      const renderer = createThreeRenderer(state, mockCanvas);

      // Mock negative dimensions
      Object.defineProperty(window, 'innerWidth', { value: -100, writable: true });
      Object.defineProperty(window, 'innerHeight', { value: 100, writable: true });

      // Should not throw and should return early
      expect(() => renderer.resize()).not.toThrow();
    });

    it('should handle high DPI displays correctly', () => {
      const renderer = createThreeRenderer(state, mockCanvas);

      // Mock high DPI
      Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true });
      Object.defineProperty(window, 'innerHeight', { value: 768, writable: true });
      Object.defineProperty(window, 'devicePixelRatio', { value: 2, writable: true });

      // Call resize
      renderer.resize();

      // Verify canvas dimensions match viewport (not scaled by DPR)
      expect(mockCanvas.width).toBe(1024);
      expect(mockCanvas.height).toBe(768);
    });
  });

  describe('renderer lifecycle', () => {
    it('should initialize successfully', () => {
      const renderer = createThreeRenderer(state, mockCanvas);
      expect(renderer.initDone).toBe(true);
      expect(typeof renderer.render).toBe('function');
      expect(typeof renderer.resize).toBe('function');
      expect(typeof renderer.dispose).toBe('function');
    });

    it('should dispose resources properly', () => {
      const renderer = createThreeRenderer(state, mockCanvas);
      expect(() => renderer.dispose()).not.toThrow();
    });
  });
});
