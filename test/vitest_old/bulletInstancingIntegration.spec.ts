import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createThreeRenderer } from '../../src/renderer/threeRenderer.js';
import { createInitialState } from '../../src/core/gameState.js';
import { RendererConfig } from '../../src/config/rendererConfig.js';
import type { GameState, Bullet } from '../../src/types/index.js';

// Mock Three.js and other dependencies but keep real exports where needed
vi.mock('three', async () => {
  const actualUnknown = await vi.importActual('three');
  const actual: any = actualUnknown as any;
  return {
    ...(actual || {}),
    WebGLRenderer: vi.fn().mockImplementation(() => ({
      setSize: vi.fn(),
      setPixelRatio: vi.fn(),
      render: vi.fn(),
      dispose: vi.fn(),
      domElement: { width: 800, height: 600 },
      info: { render: { calls: 0 } },
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
      getWorldDirection: vi.fn(() => ({ normalize: vi.fn() })),
      up: { normalize: vi.fn() },
    })),
    // keep PlaneGeometry and InstancedBufferAttribute from actual if available
    PlaneGeometry: actual && actual.PlaneGeometry ? actual.PlaneGeometry : vi.fn(),
    InstancedBufferAttribute:
      actual && actual.InstancedBufferAttribute ? actual.InstancedBufferAttribute : vi.fn(),
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
      position: { set: vi.fn(), copy: vi.fn() },
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
      copy: vi.fn().mockReturnThis(),
      crossVectors: vi.fn().mockReturnThis(),
      normalize: vi.fn().mockReturnThis(),
      clone: vi.fn().mockReturnThis(),
      setFromMatrixColumn: vi.fn().mockReturnThis(),
      lerpVectors: vi.fn().mockImplementation(function thisAsVec3(
        this: { x: number; y: number; z: number },
        a: any,
        b: any,
        t: number,
      ) {
        this.x = (a.x ?? 0) + ((b.x ?? 0) - (a.x ?? 0)) * t;
        this.y = (a.y ?? 0) + ((b.y ?? 0) - (a.y ?? 0)) * t;
        this.z = (a.z ?? 0) + ((b.z ?? 0) - (a.z ?? 0)) * t;
        return this;
      }),
    })),
    Quaternion: vi.fn().mockImplementation(() => ({})),
    CanvasTexture: vi.fn(),
    CubeTexture: vi.fn(),
    ClampToEdgeWrapping: vi.fn(),
    LinearFilter: vi.fn(),
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

// Mock other dependencies
vi.mock('../../src/renderer/effects.js', () => ({
  createEffectsManager: vi.fn(() => null),
}));

vi.mock('../../src/core/assetLoader.js', () => ({
  loadGLTF: vi.fn(),
}));

vi.mock('../../src/core/svgLoader.js', () => ({
  getSVGLoader: vi.fn(),
  loadSVGAsset: vi.fn(),
}));

describe('Bullet Instancing Integration', () => {
  let mockCanvas: HTMLCanvasElement;
  let state: GameState;
  let originalInstancingConfig: boolean;

  beforeEach(() => {
    // Store original config
    originalInstancingConfig = RendererConfig.instancing.enableBullets;

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

    // Create test state
    state = createInitialState();
  });

  afterEach(() => {
    // Restore original config
    RendererConfig.instancing.enableBullets = originalInstancingConfig;
  });

  it('should initialize bullet instancer when instancing is enabled', () => {
    RendererConfig.instancing.enableBullets = true;

    const renderer = createThreeRenderer(state, mockCanvas);
    expect(renderer).toBeDefined();

    // Cleanup
    renderer.dispose();
  });

  it('should not initialize bullet instancer when instancing is disabled', () => {
    RendererConfig.instancing.enableBullets = false;

    const renderer = createThreeRenderer(state, mockCanvas);
    expect(renderer).toBeDefined();

    // Cleanup
    renderer.dispose();
  });

  it('should handle bullet rendering with instancing enabled', () => {
    RendererConfig.instancing.enableBullets = true;

    const renderer = createThreeRenderer(state, mockCanvas);

    // Add some bullets to the state
    const bullets: Bullet[] = [
      {
        id: 1,
        ownerShipId: 0,
        pos: { x: 10, y: 20, z: 30 },
        vel: { x: 1, y: 0, z: 0 },
        ttl: 5,
        damage: 1,
        ownerTeam: 'red',
        weaponId: 'test',
        prevPos: { x: 10, y: 20, z: 30 }, // Initialize for interpolation
      },
      {
        id: 2,
        ownerShipId: 0,
        pos: { x: 40, y: 50, z: 60 },
        vel: { x: -1, y: 0, z: 0 },
        ttl: 5,
        damage: 1,
        ownerTeam: 'blue',
        weaponId: 'test',
        prevPos: { x: 40, y: 50, z: 60 }, // Initialize for interpolation
      },
      {
        id: 3,
        ownerShipId: 0,
        pos: { x: 70, y: 80, z: 90 },
        vel: { x: 0, y: 1, z: 0 },
        ttl: 5,
        damage: 1,
        ownerTeam: 'red',
        weaponId: 'test',
        prevPos: { x: 70, y: 80, z: 90 }, // Initialize for interpolation
      },
    ];

    state.bullets = bullets.map((b) => ({ ...b, prevPos: { ...b.pos } }));

    // Render a frame - this should trigger bullet sync and transforms
    const dt = 1 / (state.simConfig?.tickRate ?? 60);
    renderer.render(dt);

    // Cleanup
    renderer.dispose();
  });

  it('should handle bullet rendering with instancing disabled (legacy mode)', () => {
    RendererConfig.instancing.enableBullets = false;

    const renderer = createThreeRenderer(state, mockCanvas);

    // Add some bullets to the state
    const bullets: Bullet[] = [
      {
        id: 1,
        ownerShipId: 0,
        pos: { x: 10, y: 20, z: 30 },
        vel: { x: 1, y: 0, z: 0 },
        ttl: 5,
        damage: 1,
        ownerTeam: 'red',
        weaponId: 'test',
        prevPos: { x: 10, y: 20, z: 30 }, // Initialize for interpolation
      },
      {
        id: 2,
        ownerShipId: 0,
        pos: { x: 40, y: 50, z: 60 },
        vel: { x: -1, y: 0, z: 0 },
        ttl: 5,
        damage: 1,
        ownerTeam: 'blue',
        weaponId: 'test',
        prevPos: { x: 40, y: 50, z: 60 }, // Initialize for interpolation
      },
    ];

    state.bullets = bullets.map((b) => ({ ...b, prevPos: { ...b.pos } }));

    // Render a frame - this should use legacy individual mesh rendering
    const dt = 1 / (state.simConfig?.tickRate ?? 60);
    renderer.render(dt);

    // Cleanup
    renderer.dispose();
  });

  it('should handle dynamic bullet addition and removal with instancing', () => {
    RendererConfig.instancing.enableBullets = true;

    const renderer = createThreeRenderer(state, mockCanvas);

    // Start with no bullets
    state.bullets = [];
    const dt = 1 / (state.simConfig?.tickRate ?? 60);
    renderer.render(dt);

    // Add bullets dynamically
    state.bullets = [
      {
        id: 1,
        ownerShipId: 0,
        pos: { x: 10, y: 20, z: 30 },
        vel: { x: 1, y: 0, z: 0 },
        ttl: 5,
        damage: 1,
        ownerTeam: 'red',
        weaponId: 'test',
        prevPos: { x: 10, y: 20, z: 30 }, // Initialize for interpolation
      },
      {
        id: 2,
        ownerShipId: 0,
        pos: { x: 40, y: 50, z: 60 },
        vel: { x: -1, y: 0, z: 0 },
        ttl: 5,
        damage: 1,
        ownerTeam: 'blue',
        weaponId: 'test',
        prevPos: { x: 40, y: 50, z: 60 }, // Initialize for interpolation
      },
    ];
    renderer.render(dt);

    // Remove one bullet
    state.bullets = [
      {
        id: 2,
        ownerShipId: 0,
        pos: { x: 45, y: 55, z: 65 },
        vel: { x: -1, y: 0, z: 0 },
        ttl: 5,
        damage: 1,
        ownerTeam: 'blue',
        weaponId: 'test',
        prevPos: { x: 45, y: 55, z: 65 }, // Initialize for interpolation
      },
    ];
    renderer.render(dt);

    // Remove all bullets
    state.bullets = [];
    renderer.render(dt);

    // Cleanup
    renderer.dispose();
  });
});
