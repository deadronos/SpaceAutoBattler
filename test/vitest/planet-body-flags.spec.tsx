import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { CELESTIAL_ENVIRONMENT, type PlanetBodyConfig } from '../../src/config/environment.js';
import { PlanetBody } from '../../src/components/environment/PlanetBody.js';
import { PlanetAtmosphere } from '../../src/components/environment/PlanetAtmosphere.js';
import { PlanetRimShell } from '../../src/components/environment/PlanetRimShell.js';
import {
  createPlanetRingBasicMaterial,
  createPlanetRingMaterial,
} from '../../src/renderer/environment/planetRingMaterial.js';
import * as createGlslMaterialMod from '../../src/renderer/materials/createGlslMaterial.js';

const mockPlanetRings = vi.hoisted(() => vi.fn(() => null));
const mockPlanetRimShell = vi.hoisted(() => vi.fn(() => null));
const mockPlanetAtmosphere = vi.hoisted(() => vi.fn(() => null));

vi.mock('@react-three/fiber', () => ({
  useFrame: vi.fn(),
  useThree: (selector?: (state: unknown) => unknown) =>
    selector ? selector({ camera: {}, gl: {}, size: { width: 800, height: 600 } }) : {},
}));

vi.mock('../../src/hooks/usePlanetTexture.js', () => ({
  usePlanetTexture: () => ({
    texture: null,
    fallbackColor: '#2e3142',
    error: undefined,
  }),
}));

vi.mock('../../src/hooks/usePrefersReducedMotion.js', () => ({
  usePrefersReducedMotion: () => false,
}));

vi.mock('../../src/app/context.js', () => ({
  useOptionalGameState: () => null,
}));

vi.mock('../../src/components/environment/PlanetRings.js', () => ({
  PlanetRings: (props: unknown) => {
    mockPlanetRings(props);
    return null;
  },
}));

vi.mock('../../src/components/environment/PlanetRimShell.js', async () => {
  const actual = await vi.importActual<
    typeof import('../../src/components/environment/PlanetRimShell.js')
  >('../../src/components/environment/PlanetRimShell.js');
  return {
    ...actual,
    PlanetRimShell: (props: Parameters<typeof actual.PlanetRimShell>[0]) => {
      mockPlanetRimShell(props);
      return actual.PlanetRimShell(props);
    },
  };
});

vi.mock('../../src/components/environment/PlanetAtmosphere.js', async () => {
  const actual = await vi.importActual<
    typeof import('../../src/components/environment/PlanetAtmosphere.js')
  >('../../src/components/environment/PlanetAtmosphere.js');
  return {
    ...actual,
    PlanetAtmosphere: (props: Parameters<typeof actual.PlanetAtmosphere>[0]) => {
      mockPlanetAtmosphere(props);
      return actual.PlanetAtmosphere(props);
    },
  };
});

const SAMPLE_PLANET: PlanetBodyConfig = {
  id: 'testGasGiant',
  textureKey: 'gasGiant12',
  radius: 1800,
  position: { x: -3200, y: 380, z: -5600 },
  rimStrength: 0.3,
  rimColor: '#ffaa44',
  atmosphereStrength: 0.55,
  atmosphereColor: '#ffb066',
  atmosphereFalloff: 2.6,
  rings: {
    innerRadius: 2200,
    outerRadius: 3800,
    color: '#9e9e9e',
    opacity: 0.85,
  },
};

let originalFeatures: typeof CELESTIAL_ENVIRONMENT.features;

beforeEach(() => {
  originalFeatures = CELESTIAL_ENVIRONMENT.features
    ? { ...CELESTIAL_ENVIRONMENT.features }
    : undefined;
  mockPlanetRings.mockClear();
  mockPlanetRimShell.mockClear();
  mockPlanetAtmosphere.mockClear();
});

afterEach(() => {
  CELESTIAL_ENVIRONMENT.features = originalFeatures;
  vi.restoreAllMocks();
});

describe('Planet fog, shadow, and feature flags (Issue #741)', () => {
  it('sets fog=false on planet ring shader and basic fallback materials', () => {
    const shaderMat = createPlanetRingMaterial({
      color: '#9e9e9e',
      opacity: 0.85,
      innerRadius: 2200,
      outerRadius: 3800,
      brightness: 1,
      fresnelStrength: 1.5,
      bloomOnly: false,
      bandFrequency: 180,
      bandStrength: 0.6,
      bandNoiseScale: 0.8,
      bandDarkness: 0.6,
      planetCenter: { x: 0, y: 0, z: 0 },
      planetRadius: 1800,
      shadowStrength: 0.8,
      penumbra: 0.05,
      lightDir: { x: 0.25, y: 0.15, z: 0.95 },
    });
    const basicMat = createPlanetRingBasicMaterial({
      tintColor: '#bfbfbf',
      opacity: 0.85,
      bloomOnly: false,
    });

    expect(shaderMat.fog).toBe(false);
    expect(basicMat.fog).toBe(false);

    shaderMat.dispose();
    basicMat.dispose();
  });

  it('sets fog=false when constructing PlanetAtmosphere and PlanetRimShell materials', () => {
    const spy = vi.spyOn(createGlslMaterialMod, 'createGlslMaterial');

    act(() => {
      TestRenderer.create(<PlanetAtmosphere strength={0.5} color="#7fb2ff" falloff={3.0} />);
    });
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ fog: false }));

    spy.mockClear();
    act(() => {
      TestRenderer.create(<PlanetRimShell radius={1800} rimStrength={0.3} rimColor="#ffaa44" />);
    });
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ fog: false }));
  });

  it('disables fog and removes shadow flags on PlanetBody sphere mesh', () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(<PlanetBody config={SAMPLE_PLANET} />);
    });

    const meshes = renderer.root.findAllByType('mesh');
    expect(meshes.length).toBeGreaterThanOrEqual(1);
    for (const mesh of meshes) {
      expect(mesh.props.castShadow).not.toBe(true);
      expect(mesh.props.receiveShadow).not.toBe(true);
    }

    const material = renderer.root.findByType('meshStandardMaterial');
    expect(material.props.fog).toBe(false);
  });

  it('honors CELESTIAL_ENVIRONMENT.features.planetRims and planetRings toggles', () => {
    CELESTIAL_ENVIRONMENT.features = {
      ...originalFeatures,
      planetRims: true,
      planetRings: true,
    };

    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(<PlanetBody config={SAMPLE_PLANET} />);
    });
    expect(mockPlanetRimShell).toHaveBeenCalledTimes(1);
    expect(mockPlanetRings).toHaveBeenCalledTimes(1);

    mockPlanetRimShell.mockClear();
    mockPlanetRings.mockClear();
    CELESTIAL_ENVIRONMENT.features = {
      ...originalFeatures,
      planetRims: false,
      planetRings: false,
    };

    act(() => {
      renderer.update(<PlanetBody config={{ ...SAMPLE_PLANET }} />);
    });
    expect(mockPlanetRimShell).not.toHaveBeenCalled();
    expect(mockPlanetRings).not.toHaveBeenCalled();
  });
});
