import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { Vector3, MeshBasicMaterial } from 'three';

type FrameCallback = (state: any, delta: number) => void;
const frameCallbacks: FrameCallback[] = [];
const gameStateMock: { current: any } = { current: undefined };

const setSearch = (search: string) => {
  const base = `${window.location.origin}${window.location.pathname}`;
  window.history.replaceState(null, '', `${base}${search}`);
};

vi.mock('@react-three/fiber', () => ({
  useFrame: (callback: FrameCallback) => {
    frameCallbacks.push(callback);
  },
  useThree: () => ({
    gl: {
      capabilities: {
        getMaxAnisotropy: () => 1,
      },
    },
    viewport: { aspect: 1 },
    size: { width: 800, height: 600 },
    scene: {},
    camera: { position: new Vector3(0, 0, 10), rotation: { y: 0, z: 0 } },
  }),
}));

vi.mock('@react-three/drei', () => ({
  useTexture: () => ({ organic: undefined, noiseRgba: undefined }),
}));

vi.mock('../../src/game/context.js', () => ({
  useOptionalGameState: () => gameStateMock.current,
}));

vi.mock('../../src/renderer/BloomProvider.js', () => ({
  useBloomRegistration: () => undefined,
}));

describe('StarDisk debug lockdown', () => {
  beforeEach(() => {
    cleanup();
    frameCallbacks.length = 0;
    vi.clearAllMocks();
    gameStateMock.current = undefined;
    setSearch('');
    for (const key of Object.keys(window)) {
      if (key.startsWith('__copilot')) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          delete (window as any)[key];
        } catch {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (window as any)[key] = undefined;
        }
      }
    }
    const residual = document.getElementById('copilot-star-screen-indicator');
    residual?.remove();
  });

  afterEach(() => {
    cleanup();
    frameCallbacks.length = 0;
  });

  const renderStarDisk = async () => {
    const { StarDisk } = await import('../../src/components/environment/StarDisk.js');
    const config = {
      color: '#ffffff',
      intensity: 1,
      direction: { x: 0, y: 0, z: -1 },
      distance: 1000,
    };
    return render(<StarDisk config={config} enabled={true} size={500} opacity={0.8} distanceMultiplier={1} />);
  };

  it('scrubs debug helpers and overlays without the debug flag', async () => {
    (window as any).__copilot_setStarLayer = () => 'sentinel';
    const overlay = document.createElement('div');
    overlay.id = 'copilot-star-screen-indicator';
    document.body.appendChild(overlay);

    await renderStarDisk();

    expect((window as any).__copilot_setStarLayer).toBeUndefined();
    expect(document.getElementById('copilot-star-screen-indicator')).toBeNull();
  });

  it('registers helpers only when the debug flag is present and clears them on unmount', async () => {
    setSearch('?copilot_debug=1');
    const { unmount, container } = await renderStarDisk();

    const meshEl = container.querySelector('mesh') as any;
    expect(meshEl).toBeTruthy();
    meshEl.userData = {};
    meshEl.layers = { set: vi.fn(), mask: 0 };
    meshEl.material = new MeshBasicMaterial();
    meshEl.visible = true;
    meshEl.renderOrder = 0;
    meshEl.getWorldPosition = () => new Vector3();

    const frame = frameCallbacks[frameCallbacks.length - 1];
    expect(frame).toBeTypeOf('function');
    frame?.(
      {
        camera: { position: { x: 0, y: 0, z: 10 }, rotation: { y: 0, z: 0 } },
        viewport: { aspect: 1 },
        size: { width: 800, height: 600 },
      },
      0.016,
    );

    expect(typeof (window as any).__copilot_setStarLayer).toBe('function');
    expect(typeof (window as any).__copilot_setStarBasicMaterial).toBe('function');

    const debugOverlay = document.createElement('div');
    debugOverlay.id = 'copilot-star-screen-indicator';
    document.body.appendChild(debugOverlay);

    unmount();

    expect((window as any).__copilot_setStarLayer).toBeUndefined();
    expect((window as any).__copilot_setStarBasicMaterial).toBeUndefined();
    expect(document.getElementById('copilot-star-screen-indicator')).toBeNull();
  });

  it('does not remove helpers during debug operation', async () => {
    setSearch('?copilot_debug=1');
    (window as any).__copilot_setStarLayer = () => 'existing';

    await renderStarDisk();

    expect((window as any).__copilot_setStarLayer).toBeTypeOf('function');
  });

  it('keeps the shader material attached when the debug flag is present', async () => {
    setSearch('?copilot_debug=1');
    const { container } = await renderStarDisk();

    const attached = container.querySelector('[attach="material"]');
    expect(attached).toBeTruthy();
    expect(attached?.nodeName.toLowerCase()).toBe('primitive');
  });

  it('advances shader time monotonically with the debug flag', async () => {
    setSearch('?copilot_debug=1');
    const materialModule = await import('../../src/renderer/starDiskMaterial.js');
    const updateSpy = vi.spyOn(materialModule, 'updateMainSequenceStarUniforms');

    const { container } = await renderStarDisk();
    const meshEl = container.querySelector('mesh') as any;
    meshEl.userData = meshEl.userData ?? {};
    meshEl.layers = meshEl.layers ?? { set: vi.fn(), mask: 0 };
    meshEl.material = meshEl.material ?? new MeshBasicMaterial();
    meshEl.visible = true;
    meshEl.renderOrder = 0;
    meshEl.getWorldPosition = () => new Vector3();

    const frame = frameCallbacks[frameCallbacks.length - 1];
    expect(frame).toBeTypeOf('function');
    frame?.(
      {
        camera: { position: { x: 0, y: 0, z: 10 }, rotation: { y: 0, z: 0 } },
        viewport: { aspect: 1 },
        size: { width: 800, height: 600 },
      },
      0.016,
    );
    frame?.(
      {
        camera: { position: { x: 0, y: 0, z: 10 }, rotation: { y: 0, z: 0 } },
        viewport: { aspect: 1 },
        size: { width: 800, height: 600 },
      },
      0.02,
    );
    frame?.(
      {
        camera: { position: { x: 0, y: 0, z: 10 }, rotation: { y: 0, z: 0 } },
        viewport: { aspect: 1 },
        size: { width: 800, height: 600 },
      },
      0.018,
    );

    const timeValues = updateSpy.mock.calls
      .map((call) => call?.[1]?.time)
      .filter((value): value is number => typeof value === 'number');
    expect(timeValues.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < timeValues.length; i += 1) {
      expect(timeValues[i]).toBeGreaterThan(timeValues[i - 1]);
    }
    updateSpy.mockRestore();
  });

  it('falls back to frame delta when the simulation time stalls', async () => {
    const simulation = { lastTickStart: 0, alpha: 0, step: 0.05 };
    gameStateMock.current = { simulation };
    const materialModule = await import('../../src/renderer/starDiskMaterial.js');
    const updateSpy = vi.spyOn(materialModule, 'updateMainSequenceStarUniforms');

    const { container } = await renderStarDisk();
    const meshEl = container.querySelector('mesh') as any;
    meshEl.userData = meshEl.userData ?? {};
    meshEl.layers = meshEl.layers ?? { set: vi.fn(), mask: 0 };
    meshEl.material = meshEl.material ?? new MeshBasicMaterial();
    meshEl.visible = true;
    meshEl.renderOrder = 0;
    meshEl.getWorldPosition = () => new Vector3();

    const frame = frameCallbacks[frameCallbacks.length - 1];
    expect(frame).toBeTypeOf('function');
    const state = {
      camera: { position: { x: 0, y: 0, z: 10 }, rotation: { y: 0, z: 0 } },
      viewport: { aspect: 1 },
      size: { width: 800, height: 600 },
    };
    frame?.(state, 0.016);
    frame?.(state, 0.018);
    frame?.(state, 0.02);

    const timeValues = updateSpy.mock.calls
      .map((call) => call?.[1]?.time)
      .filter((value): value is number => typeof value === 'number');
    expect(timeValues.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < timeValues.length; i += 1) {
      expect(timeValues[i]).toBeGreaterThan(timeValues[i - 1]);
    }
    updateSpy.mockRestore();
  });

  it('realigns with simulation time once the clock advances', async () => {
    const simulation = { lastTickStart: 0, alpha: 0, step: 0.05 };
    gameStateMock.current = { simulation };
    const materialModule = await import('../../src/renderer/starDiskMaterial.js');
    const updateSpy = vi.spyOn(materialModule, 'updateMainSequenceStarUniforms');

    const { container } = await renderStarDisk();
    const meshEl = container.querySelector('mesh') as any;
    meshEl.userData = meshEl.userData ?? {};
    meshEl.layers = meshEl.layers ?? { set: vi.fn(), mask: 0 };
    meshEl.material = meshEl.material ?? new MeshBasicMaterial();
    meshEl.visible = true;
    meshEl.renderOrder = 0;
    meshEl.getWorldPosition = () => new Vector3();

    const frame = frameCallbacks[frameCallbacks.length - 1];
    expect(frame).toBeTypeOf('function');
    const state = {
      camera: { position: { x: 0, y: 0, z: 10 }, rotation: { y: 0, z: 0 } },
      viewport: { aspect: 1 },
      size: { width: 800, height: 600 },
    };
    frame?.(state, 0.016);
    simulation.lastTickStart = 0.75;
    simulation.alpha = 0;
    frame?.(state, 0.02);

    const timeValues = updateSpy.mock.calls
      .map((call) => call?.[1]?.time)
      .filter((value): value is number => typeof value === 'number');
    expect(timeValues.length).toBeGreaterThanOrEqual(2);
    const last = timeValues[timeValues.length - 1];
    expect(last).toBeCloseTo(0.75, 6);
    expect(last).toBeGreaterThan(timeValues[timeValues.length - 2]);
    updateSpy.mockRestore();
  });

  it('uses the render clock when available', async () => {
    const materialModule = await import('../../src/renderer/starDiskMaterial.js');
    const updateSpy = vi.spyOn(materialModule, 'updateMainSequenceStarUniforms');

    const { container } = await renderStarDisk();
    const meshEl = container.querySelector('mesh') as any;
    meshEl.userData = meshEl.userData ?? {};
    meshEl.layers = meshEl.layers ?? { set: vi.fn(), mask: 0 };
    meshEl.material = meshEl.material ?? new MeshBasicMaterial();
    meshEl.visible = true;
    meshEl.renderOrder = 0;
    meshEl.getWorldPosition = () => new Vector3();

    const frame = frameCallbacks[frameCallbacks.length - 1];
    expect(frame).toBeTypeOf('function');
    const clock = { getElapsedTime: vi.fn() };
    const state = {
      camera: { position: { x: 0, y: 0, z: 10 }, rotation: { y: 0, z: 0 } },
      viewport: { aspect: 1 },
      size: { width: 800, height: 600 },
      clock,
    };
    clock.getElapsedTime.mockReturnValue(0.12);
    frame?.(state, 0.016);
    clock.getElapsedTime.mockReturnValue(0.42);
    frame?.(state, 0.016);
    const timeValues = updateSpy.mock.calls
      .map((call) => call?.[1]?.time)
      .filter((value): value is number => typeof value === 'number');
    expect(timeValues.length).toBeGreaterThanOrEqual(2);
    expect(timeValues[timeValues.length - 1]).toBeCloseTo(0.42, 6);
    expect(timeValues[timeValues.length - 1]).toBeGreaterThan(timeValues[timeValues.length - 2]);
    updateSpy.mockRestore();
  });
});
