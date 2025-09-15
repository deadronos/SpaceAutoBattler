/* eslint-env node, browser, vitest */
 
// Provide a minimal `process.env` declaration for the test runtime so TypeScript
// does not error on `process` usage in tests. We keep it narrow to avoid
// introducing broad `any` usage.
declare var process: { env: { [key: string]: string | undefined } };
// Enable debug logging for AI tests by default so test instrumentation and
// intent-selection debug messages are available during CI/local runs.
// This must be set before any test-time code relies on DEBUG_AI.
process.env.DEBUG_AI = process.env.DEBUG_AI || '1';
// intent-selection debug messages are available during CI/local runs.
// This must be set before any test-time code relies on DEBUG_AI.
import { beforeAll, vi, expect } from 'vitest';
import { createRNG } from '../../src/utils/rng.js';
import type { GameState, Ship, Bullet } from '../../src/types/index.js';
import { SpatialGrid } from '../../src/utils/spatialGrid.js';
import { AIController } from '../../src/core/ai/controller.js';
import { AggressiveSpatialOptimizer } from '../../src/core/ai/aggressiveSpatialOptimizer.js';
import { DEFAULT_BEHAVIOR_CONFIG } from '../../src/config/behaviorConfig.js';
import { DefaultSimConfig } from '../../src/config/simConfig.js';
import { getShipClassConfig, TURRET_CONFIGS } from '../../src/config/entitiesConfig.js';

// Mock WebGL context for tests
export const glStub = {
  createTexture: vi.fn(() => ({})),
  deleteTexture: vi.fn(),
  createBuffer: vi.fn(() => ({})),
  deleteBuffer: vi.fn(),
  createShader: vi.fn(() => ({})),
  deleteShader: vi.fn(),
  createProgram: vi.fn(() => ({})),
  deleteProgram: vi.fn(),
  getParameter: vi.fn(() => 'WebGL 2.0'),
  getExtension: vi.fn(() => null),
  enable: vi.fn(),
  disable: vi.fn(),
  clear: vi.fn(),
  viewport: vi.fn(),
  bindTexture: vi.fn(),
  texParameteri: vi.fn(),
  texImage2D: vi.fn(),
  generateMipmap: vi.fn(),
  useProgram: vi.fn(),
  getUniformLocation: vi.fn(() => ({})),
  uniformMatrix4fv: vi.fn(),
  uniform1f: vi.fn(),
  uniform1i: vi.fn(),
  bindBuffer: vi.fn(),
  bufferData: vi.fn(),
  vertexAttribPointer: vi.fn(),
  enableVertexAttribArray: vi.fn(),
  drawArrays: vi.fn(),
  drawElements: vi.fn(),
  clearColor: vi.fn(),
  blendFunc: vi.fn(),
  depthFunc: vi.fn(),
  cullFace: vi.fn(),
  getShaderParameter: vi.fn(() => true),
  getShaderInfoLog: vi.fn(() => ''),
  getProgramParameter: vi.fn(() => true),
  getProgramInfoLog: vi.fn(() => ''),
  shaderSource: vi.fn(),
  compileShader: vi.fn(),
  attachShader: vi.fn(),
  linkProgram: vi.fn(),
  getAttribLocation: vi.fn(() => 0),
  // WebGL shader precision support
  getShaderPrecisionFormat: vi.fn(() => ({ precision: 23, rangeMin: 127, rangeMax: 127 })),
  VERTEX_SHADER: 35633,
  FRAGMENT_SHADER: 35632,
  HIGH_FLOAT: 36338,
  MEDIUM_FLOAT: 36337,
  LOW_FLOAT: 36336,
  // WebGL 3D texture support
  texImage3D: vi.fn(),
  TEXTURE_3D: 32879,
  TEXTURE_2D_ARRAY: 35866,
};

// Mock Three.js classes
export const mockThree = {
  Vector3: class Vector3 {
    x: number;
    y: number;
    z: number;
    constructor(x = 0, y = 0, z = 0) {
      this.x = x;
      this.y = y;
      this.z = z;
    }
    clone() {
      return new Vector3(this.x, this.y, this.z);
    }
    copy(v: Vector3) {
      this.x = v.x;
      this.y = v.y;
      this.z = v.z;
      return this;
    }
    set(x: number, y: number, z: number) {
      this.x = x;
      this.y = y;
      this.z = z;
      return this;
    }
    add(v: Vector3) {
      this.x += v.x;
      this.y += v.y;
      this.z += v.z;
      return this;
    }
    sub(v: Vector3) {
      this.x -= v.x;
      this.y -= v.y;
      this.z -= v.z;
      return this;
    }
    multiplyScalar(s: number) {
      this.x *= s;
      this.y *= s;
      this.z *= s;
      return this;
    }
    length() {
      return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
    }
    normalize() {
      const l = this.length();
      if (l > 0) this.multiplyScalar(1 / l);
      return this;
    }
  },
  Matrix4: class Matrix4 {
    elements: number[] = new Array(16).fill(0);
    constructor() {
      this.identity();
    }
    identity() {
      this.elements = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
      return this;
    }
  },
  Texture: class Texture {},
  BufferGeometry: class BufferGeometry {},
  Material: class Material {},
  Mesh: class Mesh {
    // Prefix unused args with underscore to satisfy no-unused-vars rule in tests
    constructor(_geometry?: any, _material?: any) {}
  },
  Scene: class Scene {},
  Camera: class Camera {},
  WebGLRenderer: class WebGLRenderer {
    constructor() {}
    render = vi.fn();
    setSize = vi.fn();
    dispose = vi.fn();
    getContext = vi.fn(() => glStub);
  },
};

// Mock performance.now
export const mockPerformance = {
  now: vi.fn(() => Date.now()),
};

// Setup global mocks
beforeAll(() => {
  // Mock WebGL context
  globalThis.WebGLRenderingContext = glStub as any;
  globalThis.WebGL2RenderingContext = glStub as any;

  // Mock canvas getContext
  HTMLCanvasElement.prototype.getContext = vi.fn((contextType: string) => {
    if (contextType === 'webgl' || contextType === 'webgl2') {
      return glStub;
    }
    return null;
  }) as any;

  // Preserve real performance.now if available to allow timing-based tests
  if (
    !(globalThis as any).performance ||
    typeof (globalThis as any).performance.now !== 'function'
  ) {
    (globalThis as any).performance = mockPerformance as any;
  }

  // Mock requestAnimationFrame
  // Cast to any to avoid NodeJS Timeout vs number return-type mismatch in tests
  globalThis.requestAnimationFrame = vi.fn(
    (cb: FrameRequestCallback) => setTimeout(cb, 16) as unknown as number,
  ) as any;
  globalThis.cancelAnimationFrame = vi.fn() as any;

  // Mock console methods to reduce noise in tests
  // Allow enabling debug logs during test runs by setting DEBUG_AI
  if (!process.env.DEBUG_AI) {
    globalThis.console = {
      ...console,
      log: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };
  }

  // Stub global.fetch so tests do not perform real network requests
  // This prevents happy-dom from attempting to connect to localhost:3000
  // and emitting ECONNREFUSED logs during the test run.
  const defaultFetchResponse = {
    ok: true,
    status: 200,
    headers: new Map<string, string>(),
    text: async () => '',
    json: async () => ({}),
    arrayBuffer: async () => new ArrayBuffer(0),
    blob: async () => ({}) as any,
    clone() {
      return this;
    },
  };

  (globalThis as any).fetch = vi.fn(async (url: any, opts?: any) => {
    try {
      // Quick heuristic: if tests explicitly stub a given URL, allow them to
      // override fetch by checking for a user-provided mock on `global.__fetchMock`.
      const fm = (globalThis as any).__fetchMock;
      if (fm && typeof fm === 'function') return fm(url, opts);
    } catch {
      // ignore and fall back to default
    }
    return defaultFetchResponse;
  }) as any;
});

// Test utilities
export function createMockGameState(overrides = {}) {
  // Use the project's DefaultSimConfig as the base for test mocks so tests
  // automatically follow upstream changes (tickRate, bounds, spatialGrid, etc.).
  const baseSim = { ...DefaultSimConfig };
  baseSim.seed = 'test-seed';

  const baseState: GameState = {
    time: 0,
    tick: 0,
    running: false,
    speedMultiplier: 1,
    rng: {
      seed: 'test-seed',
      next: () => 0.5,
      int: (min: number, max: number) => Math.floor((min + max) / 2),
      pick: <T>(arr: T[]) => arr[0],
    },
    nextId: 1,
    // Merge DefaultSimConfig with any lightweight test overrides
    simConfig: { ...baseSim },
    ships: [] as Ship[],
    shipIndex: new Map(),
    // Version counter required by GameState type
    shipDataVersion: 0,
    bullets: [] as Bullet[],
    score: { red: 0, blue: 0 },
    behaviorConfig: { ...DEFAULT_BEHAVIOR_CONFIG },
  };

  // Initialize spatial grid and optimizer for tests
  const spatialGrid = new SpatialGrid(
    baseState.simConfig.spatialGrid.cellSize,
    baseState.simConfig.simBounds,
  );
  const aggressiveSpatialOptimizer = new AggressiveSpatialOptimizer(
    spatialGrid,
    baseState.simConfig.spatialGrid.cellSize,
  );
  const aiController = new AIController(baseState, aggressiveSpatialOptimizer);

  // Assign the created AIController to the baseState
  baseState.aiController = aiController;

  return { ...baseState, spatialGrid, aggressiveSpatialOptimizer, aiController, ...overrides };
}

export function createMockShip(overrides = {}) {
  // Use canonical fighter config to derive mock defaults so tests follow config changes
  const fighterCfg = getShipClassConfig('fighter');
  const defaultTurrets = Array.isArray(fighterCfg.turrets)
    ? fighterCfg.turrets.map((t: any, idx: number) => ({ id: `${t.id}-${idx}`, cooldownLeft: 0 }))
    : [];

  const baseShip = {
    id: 1,
    team: 'red' as const,
    class: 'fighter' as const,
    pos: { ...TEST_DEFAULTS.defaultPos },
    // prevPos used by renderer interpolation; keep in sync with pos for tests
    prevPos: { ...TEST_DEFAULTS.defaultPos },
    vel: { x: 0, y: 0, z: 0 },
    orientation: {
      pitch: 0,
      yaw: 0,
      roll: 0,
    },
    // prevOrientation used by renderer interpolation
    prevOrientation: { pitch: 0, yaw: 0, roll: 0 },
    dir: 0,
    targetId: null,
    health: fighterCfg.baseHealth,
    maxHealth: fighterCfg.baseHealth,
    armor: fighterCfg.armor ?? 0,
    shield: fighterCfg.shield ?? 0,
    maxShield: fighterCfg.shield ?? 0,
    shieldRegen: fighterCfg.shieldRegen ?? 0,
    speed: fighterCfg.speed,
    turnRate: fighterCfg.turnRate,
    turrets: defaultTurrets,
    kills: 0,
    level: { level: 1, xp: 0, nextLevelXp: 50 },
  };

  return { ...baseShip, ...overrides };
}

export function createMockBullet(overrides = {}) {
  // Derive default bullet damage from the fighter turret config when available
  const fighterTurretDamage =
    (TURRET_CONFIGS['fighter-cannon'] && TURRET_CONFIGS['fighter-cannon'].damage) || 1;
  const baseBullet = {
    id: 1,
    ownerShipId: 1,
    ownerTeam: 'red' as const,
    pos: { ...TEST_DEFAULTS.defaultPos },
    // prevPos used by renderer interpolation
    prevPos: { ...TEST_DEFAULTS.defaultPos },
    vel: { x: TEST_DEFAULTS.defaultVelX, y: 0, z: 0 },
    ttl: 3,
    damage: fighterTurretDamage,
  };

  return { ...baseBullet, ...overrides };
}

// Test helper: advance a single controller/frame step deterministically.
// This mirrors the main loop: call AI update, then advance time/tick and
// optionally rebuild the spatial grid for the next frame. Use this from
// tests to avoid brittle timing assumptions about when `state.tick` changes.
export function stepControllerFrame(
  state: GameState,
  aiController?: InstanceType<typeof AIController>,
  dt?: number,
): void {
  // Default dt derives from the state's simConfig.tickRate so tests follow the
  // configured simulation tick rate (tests previously assumed 60Hz).
  if (dt === undefined) dt = 1 / (state.simConfig?.tickRate ?? 60);
  try {
    if (aiController) aiController.updateAllShips(dt);
  } catch {
    /* ignore for test resilience */
  }

  // Advance time and tick like the main loop does after simulateStep
  state.time += dt * (state.speedMultiplier ?? 1);
  state.tick = (state.tick ?? 0) + 1;

  // Rebuild spatial index for deterministic tests (main loop does this after AI)
  try {
    if (state.spatialGrid && state.behaviorConfig?.globalSettings.enableSpatialIndex) {
      state.spatialGrid.rebuild(
        state.ships.map((s) => ({ id: s.id, pos: s.pos, radius: 16, team: s.team })),
      );
    }
  } catch {
    /* best-effort */
  }
}

// Backwards-compatible alias used across some tests
export function simulateStep(state: GameState, dt?: number) {
  return stepControllerFrame(
    state,
    state.aiController as unknown as InstanceType<typeof AIController>,
    dt,
  );
}

// Pool testing utilities
export function poolAssert(
  pool: { allocated: Set<unknown>; freeList: unknown[] },
  expectedAllocated: number,
  expectedFree: number,
): void {
  expect(pool.allocated.size).toBe(expectedAllocated);
  expect(pool.freeList.length).toBe(expectedFree);
}

// RNG testing utilities
export function createSeededRNG(seed: string) {
  return createRNG(seed);
}

// Config testing utilities
export type ConfigLike = { [k: string]: unknown };
export function validateConfigStructure(config: ConfigLike, expectedKeys: string[]) {
  expectedKeys.forEach((key) => {
    expect(config).toHaveProperty(key);
  });
}

// AI testing utilities
export function createMockAIState(overrides = {}) {
  const baseAIState = {
    currentIntent: 'idle' as const,
    intentEndTime: 0,
    lastIntentReevaluation: 0,
    preferredRange: 300,
  };

  return { ...baseAIState, ...overrides };
}

// Combat testing utilities
export type ShipLike = { shield: number; armor: number; health: number } & Record<string, unknown>;
export function simulateDamage(ship: ShipLike, damage: number): number {
  let dmgLeft = damage;

  // Apply to shield first
  if ((ship.shield ?? 0) > 0) {
    const absorb = Math.min((ship.shield as number) ?? 0, dmgLeft);
     
    (ship as any).shield -= absorb;
    dmgLeft -= absorb;
  }

  // Apply remaining to health (after armor)
  if (dmgLeft > 0) {
    const effective = Math.max(1, dmgLeft - ((ship.armor as number) ?? 0) * 0.3);
     
    (ship as any).health -= effective;
    return effective; // Return actual damage dealt
  }

  return 0;
}

// Boundary testing utilities
export function testBoundaryBehavior(
  position: { x: number; y: number; z: number },
  bounds: { width: number; height: number; depth: number },
  behavior: string,
) {
  const result = { ...position };

  if (behavior === 'bounce') {
    if (result.x < 0) {
      result.x = 0;
    } else if (result.x > bounds.width) {
      result.x = bounds.width;
    }
    if (result.y < 0) {
      result.y = 0;
    } else if (result.y > bounds.height) {
      result.y = bounds.height;
    }
    if (result.z < 0) {
      result.z = 0;
    } else if (result.z > bounds.depth) {
      result.z = bounds.depth;
    }
  } else if (behavior === 'wrap') {
    if (result.x < 0) result.x += bounds.width;
    else if (result.x > bounds.width) result.x -= bounds.width;
    if (result.y < 0) result.y += bounds.height;
    else if (result.y > bounds.height) result.y -= bounds.height;
    if (result.z < 0) result.z += bounds.depth;
    else if (result.z > bounds.depth) result.z -= bounds.depth;
  }

  return result;
}

// Test helper: assert a ship's turret count matches its class config
export function expectShipTurretCountFromConfig(ship: { turrets?: unknown[] }, shipClass: string) {
  // @ts-expect-error - tests pass plain strings; avoid importing internal ShipClass type here
  const cfg = getShipClassConfig(shipClass as unknown as string);
  const expected = Array.isArray(cfg.turrets) ? cfg.turrets.length : 0;
  expect(ship.turrets).toHaveLength(expected);
}

// Canonical test constants and helpers
// These provide a single source of truth for tests so hardcoded numbers
// are easy to maintain and driven from real configs when possible.
export const TEST_DEFAULTS = {
  // Derived from DefaultSimConfig where sensible
  tickRate: DefaultSimConfig?.tickRate ?? 10,
  simBounds: DefaultSimConfig?.simBounds ?? { width: 2000, height: 2000, depth: 1000 },
  spatialCellSize: DefaultSimConfig?.spatialGrid?.cellSize ?? 64,

  // Animation / timing
  animationFrameMs: 16,
  longTimeoutMs: 60000,

  // Positioning and velocities used across many tests
  defaultPos: { x: 100, y: 100, z: 100 },
  zeroPos: { x: 0, y: 0, z: 0 },
  defaultVelX: 400,

  // AI / behavior defaults (fall back to DEFAULT_BEHAVIOR_CONFIG)
  // Test-only: access behavior config with a minimal lint suppression so tests can
  // follow changes to DEFAULT_BEHAVIOR_CONFIG without importing deep types.
   
  preferredRange: (DEFAULT_BEHAVIOR_CONFIG as unknown as any)?.preferredRange ?? 300,
   
  closeRangeMultiplier: (DEFAULT_BEHAVIOR_CONFIG as unknown as any)?.closeRangeMultiplier ?? 0.6,
   
  mediumRangeMultiplier: (DEFAULT_BEHAVIOR_CONFIG as unknown as any)?.mediumRangeMultiplier ?? 1.0,
   
  boundarySafetyMargin:
    (DEFAULT_BEHAVIOR_CONFIG as unknown as any)?.globalSettings?.boundarySafetyMargin ?? 50,

  // Renderer / DOM sizes used in integration tests
  rendererDom: { width: 800, height: 600 },

  // Movement thresholds used by smoke / movement assertions
  movementThreshold: 10,
};

export function getTestDtFromState(
  state: GameState | { simConfig?: { tickRate?: number } } = { simConfig: DefaultSimConfig },
) {
  const rate = state?.simConfig?.tickRate ?? TEST_DEFAULTS.tickRate;
  return 1 / rate;
}

export function getSimBoundsFromState(
  state:
    | GameState
    | { simConfig?: { simBounds?: { width: number; height: number; depth: number } } } = {
    simConfig: DefaultSimConfig,
  },
) {
  return state?.simConfig?.simBounds ?? TEST_DEFAULTS.simBounds;
}

// Centralized accessors for sim config rates used by tests
export function getTargetUpdateRate() {
  return DefaultSimConfig?.targetUpdateRate ?? 0.5;
}
export function getIntentReevaluationRate() {
  return DefaultSimConfig?.intentReevaluationRate ?? 0.3;
}
