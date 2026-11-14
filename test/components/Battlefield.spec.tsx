import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { cleanup, render } from '@testing-library/react';
import {
  ACESFilmicToneMapping,
  AgXToneMapping,
  AxesHelper,
  NeutralToneMapping,
  NoToneMapping,
  SRGBColorSpace,
} from 'three';
import { Grid, OrbitControls } from '@react-three/drei';
import { CameraRig } from '../../src/components/CameraRig.js';
import {
  ErrorCategory,
  getErrorCounts,
  resetErrorCounts,
  setErrorReportingEnabled,
} from '../../src/utils/errorReporting.js';

const mockState = {
  queries: {
    ships: {},
    turrets: {},
    projectiles: {},
  },
};

const canvasPropsCalls = vi.hoisted(() => [] as Array<{ onPointerMissed?: () => void }>);
const mockSelectShip = vi.hoisted(() => vi.fn());
const canvasOnCreatedGl = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }));
const uiStoreState = vi.hoisted(() => ({
  postprocessingEnabled: false,
  qualityPreset: 'high' as 'low' | 'medium' | 'high' | 'auto',
  detectedQualityTier: 'high' as 'low' | 'medium' | 'high',
}));
const mountCounts = vi.hoisted(() => ({
  celestialEnvironment: 0,
  particleTrails: 0,
}));

vi.mock('@react-three/fiber', () => ({
  Canvas: ({
    children,
    onPointerMissed,
    onCreated,
  }: {
    children: React.ReactNode;
    onPointerMissed?: () => void;
    onCreated?: (state: { gl: unknown }) => void;
  }) => {
    const createdRef = React.useRef(false);
    React.useEffect(() => {
      if (!createdRef.current && canvasOnCreatedGl.current && onCreated) {
        createdRef.current = true;
        onCreated({ gl: canvasOnCreatedGl.current });
      }
    }, [onCreated]);
    canvasPropsCalls.push({ onPointerMissed });
    return <>{children}</>;
  },
}));

vi.mock('@react-three/drei', () => ({
  OrbitControls: vi.fn(() => null),
  Grid: vi.fn(() => null),
  useGLTF: Object.assign(vi.fn(), { setDecoderPath: vi.fn() }),
}));

vi.mock('../../src/components/CameraRig.js', () => ({
  CameraRig: vi.fn(() => null),
}));

vi.mock('../../src/app/context.js', () => ({
  useOptionalGameState: () => mockState,
}));

vi.mock('../../src/app/uiStore.js', () => ({
  useUiStore: Object.assign(
    (selector: (state: typeof uiStoreState) => unknown) => selector(uiStoreState),
    {
      getState: () => ({ selectShip: mockSelectShip }),
    },
  ),
}));

vi.mock('../../src/renderer/bloom/index.js', () => ({
  BloomProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../../src/components/PostprocessingLazy.js', () => ({ default: () => null }));
vi.mock('../../src/components/ParticleTrails.js', () => ({
  ParticleTrails: () => {
    React.useEffect(() => {
      mountCounts.particleTrails += 1;
    }, []);
    return null;
  },
}));
vi.mock('../../src/components/HudOverlayCollector.js', () => ({ HudOverlayCollector: () => null }));
vi.mock('../../src/components/explosions/ExplosionRendererCore.js', () => ({
  ExplosionsLayer: () => null,
}));
vi.mock('../../src/components/PerfMonitorOverlay.js', () => ({ PerfMonitorOverlay: () => null }));
vi.mock('../../src/components/DynamicResScaler.js', () => ({ default: () => null }));
vi.mock('../../src/components/environment/CelestialEnvironment.js', () => ({
  CelestialEnvironment: () => {
    React.useEffect(() => {
      mountCounts.celestialEnvironment += 1;
    }, []);
    return null;
  },
}));
vi.mock('../../src/components/BattlefieldSystems.js', () => ({ BattlefieldSystems: () => null }));
vi.mock('../../src/components/layers/ShipsLayer.js', () => ({ ShipsLayer: () => null }));
vi.mock('../../src/components/layers/ProjectilesLayer.js', () => ({
  ProjectilesLayer: () => null,
}));
vi.mock('../../src/components/layers/MuzzleFlashInstancedLayer.js', () => ({
  MuzzleFlashInstancedLayer: () => null,
}));
vi.mock('../../src/components/layers/TurretsLayer.js', () => ({ TurretsLayer: () => null }));
vi.mock('../../src/components/layers/StarsField.js', () => ({ StarsField: () => null }));
vi.mock('../../src/components/layers/WorkerShipsLayer.js', () => ({
  WorkerShipsLayer: () => null,
}));
vi.mock('../../src/renderer/webglDebugWrapper.js', () => ({
  installWebGLDebugHooks: vi.fn(),
}));
vi.mock('../../src/game/SimulationBridge.js', () => ({
  shouldRenderWorkerShips: () => false,
  shouldRenderWorkerShipsOnly: () => false,
}));

vi.mock('three', async () => {
  const actual = await vi.importActual<typeof import('three')>('three');
  // three@0.186 ships a CommonJS entry that is just `module.exports = require('./three.module.js')`.
  // Vitest exposes it through a CJS interop wrapper whose named exports are not own-enumerable
  // (own keys are only `default`, or `module.exports` on some Node versions), so spreading
  // `actual` directly drops every constant (e.g. SRGBColorSpace, NoToneMapping).
  // Unwrap the underlying ESM namespace first so the spread preserves all real exports.
  const interop = actual as unknown as Record<string, unknown>;
  const actualNamespace =
    (interop['module.exports'] as typeof actual | undefined) ??
    (interop.default as typeof actual | undefined) ??
    actual;
  return {
    ...actualNamespace,
    AxesHelper: vi.fn().mockImplementation(function MockAxesHelper(size: number) {
      this.size = size;
      this.dispose = vi.fn();
    }),
  };
});

let originalLocation: Location | undefined;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  delete (window as Window & { __copilotDebugForce?: boolean }).__copilotDebugForce;
  if (originalLocation) {
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
  }
});

beforeEach(() => {
  canvasPropsCalls.length = 0;
  mockSelectShip.mockReset();
  canvasOnCreatedGl.current = null;
  uiStoreState.postprocessingEnabled = false;
  uiStoreState.qualityPreset = 'high';
  uiStoreState.detectedQualityTier = 'high';
  mountCounts.celestialEnvironment = 0;
  mountCounts.particleTrails = 0;
  resetErrorCounts();
  setErrorReportingEnabled(true);
  originalLocation = window.location;
});

describe('Battlefield', () => {
  it('mounts the camera rig alongside OrbitControls', async () => {
    const { Battlefield } = await import('../../src/components/Battlefield.js');
    render(<Battlefield />);

    expect(vi.mocked(OrbitControls)).toHaveBeenCalled();
    expect(vi.mocked(CameraRig)).toHaveBeenCalled();
  });

  it('creates AxesHelper once across rerenders', async () => {
    (window as Window & { __copilotDebugForce?: boolean }).__copilotDebugForce = true;
    const { Battlefield } = await import('../../src/components/Battlefield.js');
    const { rerender } = render(<Battlefield />);

    rerender(<Battlefield />);
    rerender(<Battlefield />);

    const axesHelperCtor = vi.mocked(AxesHelper);
    expect(axesHelperCtor).toHaveBeenCalledTimes(1);
    expect(axesHelperCtor).toHaveBeenCalledWith(200);
  });

  it('does not mount Grid or AxesHelper when debug is off', async () => {
    const { Battlefield } = await import('../../src/components/Battlefield.js');
    const { container } = render(<Battlefield />);

    expect(vi.mocked(Grid)).not.toHaveBeenCalled();
    expect(vi.mocked(AxesHelper)).not.toHaveBeenCalled();
    expect(container.querySelector('primitive')).toBeNull();
  });

  it('mounts Grid and AxesHelper when copilot_debug=1 is in the query string', async () => {
    Object.defineProperty(window, 'location', {
      value: { search: '?copilot_debug=1' },
      writable: true,
      configurable: true,
    });
    const { Battlefield } = await import('../../src/components/Battlefield.js');
    const { container } = render(<Battlefield />);

    expect(vi.mocked(Grid)).toHaveBeenCalled();
    expect(vi.mocked(AxesHelper)).toHaveBeenCalledWith(200);
    expect(container.querySelector('primitive')).not.toBeNull();
  });

  it('does not mount Grid or AxesHelper when debug is on but planets are hidden', async () => {
    (window as Window & { __copilotDebugForce?: boolean }).__copilotDebugForce = true;
    Object.defineProperty(window, 'location', {
      value: { search: '?copilot_debug=1&copilot_hide_planets=1' },
      writable: true,
      configurable: true,
    });
    const { Battlefield } = await import('../../src/components/Battlefield.js');
    const { container } = render(<Battlefield />);

    expect(vi.mocked(Grid)).not.toHaveBeenCalled();
    expect(vi.mocked(AxesHelper)).not.toHaveBeenCalled();
    expect(container.querySelector('primitive')).toBeNull();
  });

  it('reports WebGL hook installation failures', async () => {
    const { configureBattlefieldRenderer } = await import('../../src/components/Battlefield.js');
    const { installWebGLDebugHooks } = await import('../../src/renderer/webglDebugWrapper.js');

    vi.mocked(installWebGLDebugHooks).mockImplementation(() => {
      throw new Error('hook install failed');
    });

    configureBattlefieldRenderer({
      outputColorSpace: undefined,
      toneMapping: undefined,
      toneMappingExposure: 0,
    } as any);

    expect(getErrorCounts()[ErrorCategory.WebGL]).toBe(1);
  });

  it('clears the selected ship when clicking empty canvas space', async () => {
    const { Battlefield } = await import('../../src/components/Battlefield.js');
    render(<Battlefield />);

    const lastCall = canvasPropsCalls.at(-1);
    expect(typeof lastCall?.onPointerMissed).toBe('function');
    lastCall?.onPointerMissed?.();
    expect(mockSelectShip).toHaveBeenCalledWith(null);
  });

  it('enables renderer tone mapping when configuring Battlefield and restores it when postprocessing becomes inactive', async () => {
    const { Battlefield, configureBattlefieldRenderer, resolveFallbackToneMapping } =
      await import('../../src/components/Battlefield.js');

    expect(resolveFallbackToneMapping('agx')).toBe(AgXToneMapping);
    expect(resolveFallbackToneMapping('aces')).toBe(ACESFilmicToneMapping);
    expect(resolveFallbackToneMapping('neutral')).toBe(NeutralToneMapping);

    const renderer = {
      outputColorSpace: undefined,
      toneMapping: NoToneMapping,
      toneMappingExposure: 0,
    } as any;
    configureBattlefieldRenderer(renderer);
    expect(renderer.outputColorSpace).toBe(SRGBColorSpace);
    expect(renderer.toneMapping).toBe(AgXToneMapping);
    expect(renderer.toneMappingExposure).toBe(1);

    // Simulate composer clearing gl.toneMapping while active, then postprocessing turning off.
    uiStoreState.postprocessingEnabled = true;
    canvasOnCreatedGl.current = renderer;
    const { rerender } = render(<Battlefield />);
    expect(renderer.toneMapping).toBe(AgXToneMapping);

    // Simulate active composer setting NoToneMapping before postprocessing is disabled.
    renderer.toneMapping = NoToneMapping;
    uiStoreState.postprocessingEnabled = false;
    rerender(<Battlefield />);
    expect(renderer.toneMapping).toBe(AgXToneMapping);
    expect(renderer.toneMappingExposure).toBe(1);
  });

  it('does not remount CelestialEnvironment or ParticleTrails when quality tier changes under auto', async () => {
    const { Battlefield } = await import('../../src/components/Battlefield.js');
    uiStoreState.qualityPreset = 'auto';
    uiStoreState.detectedQualityTier = 'high';

    const { rerender } = render(<Battlefield />);
    expect(mountCounts.celestialEnvironment).toBe(1);
    expect(mountCounts.particleTrails).toBe(1);

    uiStoreState.detectedQualityTier = 'medium';
    rerender(<Battlefield />);
    uiStoreState.detectedQualityTier = 'low';
    rerender(<Battlefield />);
    uiStoreState.detectedQualityTier = 'high';
    rerender(<Battlefield />);

    expect(mountCounts.celestialEnvironment).toBe(1);
    expect(mountCounts.particleTrails).toBe(1);
  });
});
