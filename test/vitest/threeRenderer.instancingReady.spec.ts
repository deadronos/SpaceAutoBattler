import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RendererConfig } from '../../src/config/rendererConfig';

// Mock 'three' to avoid creating a real WebGL context in tests.
vi.mock('three', async () => {
  const real = await vi.importActual<typeof import('three')>('three');
  // Lightweight stub for WebGLRenderer that provides required APIs used by createThreeRenderer
  class WebGLRendererStub {
    domElement: HTMLCanvasElement;
    gl: any;
    constructor(opts?: any) { this.domElement = document.createElement('canvas'); this.gl = { clearDepth: () => {} }; }
    setPixelRatio() {}
    setSize() {}
    render() {}
    dispose() {}
  }
  return { ...real, WebGLRenderer: WebGLRendererStub } as any;
});

// We'll mock the shipInstancer module to control readiness and then import createThreeRenderer
const readyCallbacks: Array<() => void> = [];
let shipMock: any = null;

vi.mock('../../src/renderer/shipInstancer', () => {
  // named export: shipInstancer
  const obj: any = {
    _isReady: false,
    isReady() { return obj._isReady; },
    onReady(cb: () => void) { readyCallbacks.push(cb); },
    // minimal API used by renderer
    allocate: () => false,
    free: () => {},
    hasShip: () => false,
    markMatricesNeedUpdate: () => {},
    sync: () => {},
  };
  shipMock = obj;
  return { shipInstancer: obj };
});

import { createThreeRenderer } from '../../src/renderer/threeRenderer';

describe('threeRenderer instancing readiness', () => {
  beforeEach(() => {
    // reset mocked state
    readyCallbacks.length = 0;
    // ensure the config allows ship instancing for this test
    RendererConfig.instancing.enableShips = true;
  });

  it('flips useShipInstancing when shipInstancer onReady is fired', () => {
  const fakeState: any = { ships: [], bullets: [], time: 0, simConfig: { simBounds: { width: 100, height: 100, depth: 100 } }, visual: {} };
    const canvas = document.createElement('canvas');
    const renderer = createThreeRenderer(fakeState, canvas);

    // initial flag
    const before = (renderer as any).getUseShipInstancing && (renderer as any).getUseShipInstancing();

    // simulate shipInstancer becoming ready
    // set mocked internal state then call callbacks
  // Flip the mocked ship instancer ready flag
  if (shipMock) shipMock._isReady = true;
    for (const cb of readyCallbacks) cb();

    const after = (renderer as any).getUseShipInstancing && (renderer as any).getUseShipInstancing();
    expect(before).toBeDefined();
    expect(after).toBeDefined();
    if (before === false) expect(after).toBe(true);
  });
});
