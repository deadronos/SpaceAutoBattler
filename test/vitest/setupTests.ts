import { beforeAll, vi } from 'vitest';
import type { GameState, Ship, Bullet } from '../../src/types/index.js';
import { DEFAULT_BEHAVIOR_CONFIG } from '../../src/config/behaviorConfig.js';
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
    clone() { return new Vector3(this.x, this.y, this.z); }
    copy(v: Vector3) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
    set(x: number, y: number, z: number) { this.x = x; this.y = y; this.z = z; return this; }
    add(v: Vector3) { this.x += v.x; this.y += v.y; this.z += v.z; return this; }
    sub(v: Vector3) { this.x -= v.x; this.y -= v.y; this.z -= v.z; return this; }
    multiplyScalar(s: number) { this.x *= s; this.y *= s; this.z *= s; return this; }
    length() { return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z); }
    normalize() { const l = this.length(); if (l > 0) this.multiplyScalar(1 / l); return this; }
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
    constructor(geometry?: any, material?: any) {}
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
  global.WebGLRenderingContext = glStub as any;
  global.WebGL2RenderingContext = glStub as any;

  // Mock canvas getContext
  HTMLCanvasElement.prototype.getContext = vi.fn((contextType: string) => {
    if (contextType === 'webgl' || contextType === 'webgl2') {
      return glStub;
    }
    return null;
  }) as any;

  // Preserve real performance.now if available to allow timing-based tests
  if (!(global as any).performance || typeof (global as any).performance.now !== 'function') {
    (global as any).performance = mockPerformance as any;
  }

  // Mock requestAnimationFrame
  // Cast to any to avoid NodeJS Timeout vs number return-type mismatch in tests
  global.requestAnimationFrame = vi.fn((cb: FrameRequestCallback) => (setTimeout(cb, 16) as unknown as number)) as any;
  global.cancelAnimationFrame = vi.fn() as any;

  // Mock console methods to reduce noise in tests
  global.console = {
    ...console,
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };

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
    blob: async () => ({} as any),
    clone() { return this; }
  };

  (global as any).fetch = vi.fn(async (url: any, opts?: any) => {
    try {
      // Quick heuristic: if tests explicitly stub a given URL, allow them to
      // override fetch by checking for a user-provided mock on `global.__fetchMock`.
      const fm = (global as any).__fetchMock;
      if (fm && typeof fm === 'function') return fm(url, opts);
    } catch (e) {
      // ignore and fall back to default
    }
    return defaultFetchResponse;
  }) as any;
});

// Test utilities
export function createMockGameState(overrides = {}) {
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
    simConfig: {
      simBounds: { width: 1000, height: 800, depth: 600 },
      tickRate: 60,
      maxEntities: 1000,
      bulletLifetime: 3,
      maxSimulationSteps: 100,
      targetUpdateRate: 1,
      boundaryBehavior: {
        ships: 'bounce' as const,
        bullets: 'remove' as const,
      },
      spatialGrid: {
        cellSize: 64,
      },
      seed: 'test-seed',
      useTimeBasedSeed: false,
    },
    ships: [] as Ship[],
    shipIndex: new Map(),
  // Version counter required by GameState type
  shipDataVersion: 0,
    bullets: [] as Bullet[],
    score: { red: 0, blue: 0 },
    behaviorConfig: { ...DEFAULT_BEHAVIOR_CONFIG },
  };

  return { ...baseState, ...overrides };
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
    pos: { x: 100, y: 100, z: 100 },
    vel: { x: 0, y: 0, z: 0 },
    orientation: {
      pitch: 0,
      yaw: 0,
      roll: 0,
    },
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
  const fighterTurretDamage = (TURRET_CONFIGS['fighter-cannon'] && TURRET_CONFIGS['fighter-cannon'].damage) || 1;
  const baseBullet = {
    id: 1,
    ownerShipId: 1,
    ownerTeam: 'red' as const,
    pos: { x: 100, y: 100, z: 100 },
    vel: { x: 400, y: 0, z: 0 },
    ttl: 3,
    damage: fighterTurretDamage,
  };

  return { ...baseBullet, ...overrides };
}

// Pool testing utilities
export function poolAssert(pool: any, expectedAllocated: number, expectedFree: number) {
  expect(pool.allocated.size).toBe(expectedAllocated);
  expect(pool.freeList.length).toBe(expectedFree);
}

// RNG testing utilities
export function createSeededRNG(seed: string) {
  const { createRNG } = require('../src/utils/rng.js');
  return createRNG(seed);
}

// Config testing utilities
export function validateConfigStructure(config: any, expectedKeys: string[]) {
  expectedKeys.forEach(key => {
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
export function simulateDamage(ship: any, damage: number) {
  let dmgLeft = damage;

  // Apply to shield first
  if (ship.shield > 0) {
    const absorb = Math.min(ship.shield, dmgLeft);
    ship.shield -= absorb;
    dmgLeft -= absorb;
  }

  // Apply remaining to health (after armor)
  if (dmgLeft > 0) {
    const effective = Math.max(1, dmgLeft - ship.armor * 0.3);
    ship.health -= effective;
    return effective; // Return actual damage dealt
  }

  return 0;
}

// Boundary testing utilities
export function testBoundaryBehavior(position: any, bounds: any, behavior: string) {
  const result = { ...position };

  if (behavior === 'bounce') {
    if (result.x < 0) { result.x = 0; }
    else if (result.x > bounds.width) { result.x = bounds.width; }
    if (result.y < 0) { result.y = 0; }
    else if (result.y > bounds.height) { result.y = bounds.height; }
    if (result.z < 0) { result.z = 0; }
    else if (result.z > bounds.depth) { result.z = bounds.depth; }
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
export function expectShipTurretCountFromConfig(ship: any, shipClass: string) {
  const cfg = getShipClassConfig(shipClass as any);
  const expected = Array.isArray(cfg.turrets) ? cfg.turrets.length : 0;
  // Use Vitest expect from global context
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { expect } = require('vitest');
  expect(ship.turrets).toHaveLength(expected);
}