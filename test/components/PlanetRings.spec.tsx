import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { cleanup, render, act } from '@testing-library/react';
import { useUiStore } from '../../src/app/uiStore.js';

const mockShaderMat = vi.hoisted(() => ({ kind: 'shader', uniforms: {} }));
const mockBasicMat = vi.hoisted(() => ({ kind: 'basic' }));
const usePlanetRingUniformsMock = vi.hoisted(() => vi.fn());

vi.mock('@react-three/fiber', () => ({
  useFrame: vi.fn(),
}));

vi.mock('../../src/renderer/environment/planetRingGeometry.js', () => ({
  createPlanetRingGeometry: () => ({ dispose: vi.fn() }),
}));

vi.mock('../../src/renderer/environment/planetRingMaterial.js', () => ({
  createPlanetRingMaterial: () => mockShaderMat,
  createPlanetRingBasicMaterial: () => mockBasicMat,
}));

vi.mock('../../src/hooks/usePlanetRingUniforms.js', () => ({
  usePlanetRingUniforms: (...args: unknown[]) => usePlanetRingUniformsMock(...args),
}));

vi.mock('../../src/debug/planetRingsDebug.js', () => ({
  installPlanetRingsDebug: vi.fn(),
}));

vi.mock('../../src/hooks/usePrefersReducedMotion.js', () => ({
  usePrefersReducedMotion: () => false,
}));

import { PlanetRings } from '../../src/components/environment/PlanetRings.js';

const DEFAULT_SNAPSHOT = (() => {
  const s = useUiStore.getState();
  return {
    postprocessingEnabled: s.postprocessingEnabled,
    qualityPreset: s.qualityPreset,
    detectedQualityTier: s.detectedQualityTier,
  };
})();

describe('PlanetRings ppEnabled alignment', () => {
  beforeEach(() => {
    usePlanetRingUniformsMock.mockClear();
    useUiStore.setState({
      postprocessingEnabled: true,
      qualityPreset: 'high',
      detectedQualityTier: 'high',
    });
  });

  afterEach(() => {
    cleanup();
    useUiStore.setState(DEFAULT_SNAPSHOT);
    delete (window as Window & { __copilot_forcePostprocessingMount?: boolean })
      .__copilot_forcePostprocessingMount;
  });

  it('uses basicMaterial and postprocessingEnabled=false when low quality disables bloom even if UI toggle is on', () => {
    useUiStore.setState({
      postprocessingEnabled: true,
      qualityPreset: 'low',
    });

    render(<PlanetRings innerRadius={10} outerRadius={20} />);

    expect(usePlanetRingUniformsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        materialToUse: mockBasicMat,
        postprocessingEnabled: false,
      }),
    );
  });

  it('switches smoothly between shader and basic materials as quality tier changes under auto', async () => {
    useUiStore.setState({
      postprocessingEnabled: true,
      qualityPreset: 'auto',
      detectedQualityTier: 'high',
    });

    render(<PlanetRings innerRadius={10} outerRadius={20} />);
    expect(usePlanetRingUniformsMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        materialToUse: mockShaderMat,
        postprocessingEnabled: true,
      }),
    );

    await act(async () => {
      useUiStore.setState({ detectedQualityTier: 'low' });
    });

    expect(usePlanetRingUniformsMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        materialToUse: mockBasicMat,
        postprocessingEnabled: false,
      }),
    );
  });

  it('honors __copilot_forcePostprocessingMount override when UI toggle is off', () => {
    (
      window as Window & { __copilot_forcePostprocessingMount?: boolean }
    ).__copilot_forcePostprocessingMount = true;
    useUiStore.setState({
      postprocessingEnabled: false,
      qualityPreset: 'low',
    });

    render(<PlanetRings innerRadius={10} outerRadius={20} />);

    expect(usePlanetRingUniformsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        materialToUse: mockShaderMat,
        postprocessingEnabled: true,
      }),
    );
  });
});
