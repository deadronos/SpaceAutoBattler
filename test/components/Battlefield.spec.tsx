import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { AxesHelper } from 'three';

const mockState = {
  queries: {
    ships: {},
    turrets: {},
    projectiles: {},
  },
};

vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@react-three/drei', () => ({
  OrbitControls: () => null,
  Grid: () => null,
}));

vi.mock('../../src/game/context.js', () => ({
  useOptionalGameState: () => mockState,
}));

vi.mock('../../src/game/uiStore.js', () => ({
  useUiStore: (selector: (state: { postprocessingEnabled: boolean }) => boolean) =>
    selector({ postprocessingEnabled: false }),
}));

vi.mock('../../src/renderer/bloom/index.js', () => ({
  BloomProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../../src/components/PostprocessingLazy.js', () => ({ default: () => null }));
vi.mock('../../src/components/ParticleTrails.js', () => ({ ParticleTrails: () => null }));
vi.mock('../../src/components/HudOverlayCollector.js', () => ({ HudOverlayCollector: () => null }));
vi.mock('../../src/components/explosions/ExplosionRendererCore.js', () => ({ ExplosionsLayer: () => null }));
vi.mock('../../src/components/PerfMonitorOverlay.js', () => ({ PerfMonitorOverlay: () => null }));
vi.mock('../../src/components/DynamicResScaler.js', () => ({ default: () => null }));
vi.mock('../../src/components/environment/CelestialEnvironment.js', () => ({ CelestialEnvironment: () => null }));
vi.mock('../../src/components/BattlefieldSystems.js', () => ({ BattlefieldSystems: () => null }));
vi.mock('../../src/components/layers/ShipsLayer.js', () => ({ ShipsLayer: () => null }));
vi.mock('../../src/components/layers/ProjectilesLayer.js', () => ({ ProjectilesLayer: () => null }));
vi.mock('../../src/components/layers/MuzzleFlashInstancedLayer.js', () => ({ MuzzleFlashInstancedLayer: () => null }));
vi.mock('../../src/components/layers/TurretsLayer.js', () => ({ TurretsLayer: () => null }));
vi.mock('../../src/components/layers/StarsField.js', () => ({ StarsField: () => null }));
vi.mock('../../src/components/layers/WorkerShipsLayer.js', () => ({ WorkerShipsLayer: () => null }));
vi.mock('../../src/renderer/webglDebugWrapper.js', () => ({ installWebGLDebugHooks: () => undefined }));
vi.mock('../../src/game/SimulationBridge.js', () => ({
  shouldRenderWorkerShips: () => false,
  shouldRenderWorkerShipsOnly: () => false,
}));

vi.mock('three', async () => {
  const actual = await vi.importActual<typeof import('three')>('three');
  return {
    ...actual,
    AxesHelper: vi.fn().mockImplementation(function MockAxesHelper(size: number) {
      this.size = size;
      this.dispose = vi.fn();
    }),
  };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('Battlefield', () => {
  it('creates AxesHelper once across rerenders', async () => {
    const { Battlefield } = await import('../../src/components/Battlefield.js');
    const { rerender } = render(<Battlefield />);

    rerender(<Battlefield />);
    rerender(<Battlefield />);

    const axesHelperCtor = vi.mocked(AxesHelper);
    expect(axesHelperCtor).toHaveBeenCalledTimes(1);
    expect(axesHelperCtor).toHaveBeenCalledWith(200);
  });
});
