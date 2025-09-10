import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RendererConfig } from '../../src/config/rendererConfig';
import type { GameState } from '../../src/types/index';

// Narrow test-side types to avoid `any` in tests and prevent linter errors
type ReadyCallback = () => void;
interface ShipInstancerMock {
  _isReady: boolean;
  isReady(): boolean;
  onReady(cb: ReadyCallback): void;
  allocate(): boolean;
  free(): void;
  hasShip(): boolean;
  markMatricesNeedUpdate(): void;
  sync(): void;
}

// Mock 'three' to avoid creating a real WebGL context in tests.
vi.mock('three', async () => {
  const real = await vi.importActual<typeof import('three')>('three');
  // Lightweight stub for WebGLRenderer that provides required APIs used by createThreeRenderer
  class WebGLRendererStub {
    domElement: HTMLCanvasElement;
    gl: { clearDepth: () => void };
    constructor(_opts?: unknown) {
      this.domElement = document.createElement('canvas');
      this.gl = { clearDepth: () => {} };
    }
    setPixelRatio(_v?: number) {}
    setSize(_w?: number, _h?: number) {}
    render() {}
    dispose() {}
  }
  return { ...real, WebGLRenderer: WebGLRendererStub } as unknown as typeof import('three');
});

// We'll mock the shipInstancer module to control readiness and then import createThreeRenderer
// To avoid TDZ/hoisting issues with vi.mock factories, attach the mock and its callbacks to globalThis
vi.mock('../../src/renderer/shipInstancer', () => {
  // named export: shipInstancer
  const readyCallbacks: ReadyCallback[] = [];
  const obj: ShipInstancerMock = {
    _isReady: false,
    isReady() {
      return obj._isReady;
    },
    onReady(cb: ReadyCallback) {
      readyCallbacks.push(cb);
    },
    // minimal API used by renderer
    allocate: () => false,
    free: () => {},
    hasShip: () => false,
    markMatricesNeedUpdate: () => {},
    sync: () => {},
  };
  // expose for test code to manipulate without referencing outer-scope lets
  const globals = globalThis as unknown as {
    __SHIP_MOCK?: ShipInstancerMock;
    __SHIP_READY_CALLBACKS?: ReadyCallback[];
  };
  globals.__SHIP_MOCK = obj;
  globals.__SHIP_READY_CALLBACKS = readyCallbacks;
  return { shipInstancer: obj };
});

import { createThreeRenderer } from '../../src/renderer/threeRenderer';

describe('threeRenderer instancing readiness', () => {
  beforeEach(() => {
    // reset mocked state (use globals set by the mock factory)
    const globals = globalThis as unknown as {
      __SHIP_MOCK?: ShipInstancerMock;
      __SHIP_READY_CALLBACKS?: ReadyCallback[];
    };
    globals.__SHIP_READY_CALLBACKS = globals.__SHIP_READY_CALLBACKS || [];
    globals.__SHIP_READY_CALLBACKS.length = 0;
    if (globals.__SHIP_MOCK) globals.__SHIP_MOCK._isReady = false;
    // ensure the config allows ship instancing for this test
    RendererConfig.instancing.enableShips = true;
  });

  it('flips useShipInstancing when shipInstancer onReady is fired', () => {
    type FakeState = {
      ships: unknown[];
      bullets: unknown[];
      time: number;
      simConfig: { simBounds: { width: number; height: number; depth: number } };
      visual: Record<string, unknown>;
    };
    const fakeState: FakeState = {
      ships: [],
      bullets: [],
      time: 0,
      simConfig: { simBounds: { width: 100, height: 100, depth: 100 } },
      visual: {},
    };
    const canvas = document.createElement('canvas');
    const renderer = createThreeRenderer(fakeState as unknown as GameState, canvas);

    // initial flag
    const getUseFn = (renderer as unknown as { getUseShipInstancing?: () => boolean })
      .getUseShipInstancing;
    const before = getUseFn ? getUseFn() : undefined;

    // simulate shipInstancer becoming ready
    // set mocked internal state then call callbacks
    const globals = globalThis as unknown as {
      __SHIP_MOCK?: ShipInstancerMock;
      __SHIP_READY_CALLBACKS?: ReadyCallback[];
    };
    if (globals.__SHIP_MOCK) globals.__SHIP_MOCK._isReady = true;
    for (const cb of globals.__SHIP_READY_CALLBACKS ?? []) cb();

    const getUseFnAfter = (renderer as unknown as { getUseShipInstancing?: () => boolean })
      .getUseShipInstancing;
    const after = getUseFnAfter ? getUseFnAfter() : undefined;
    expect(before).toBeDefined();
    expect(after).toBeDefined();
    if (before === false) expect(after).toBe(true);
  });
});
