import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { cleanup, render } from '@testing-library/react';
import { Matrix4, ShaderMaterial, Vector3 } from 'three';
import { CELESTIAL_ENVIRONMENT } from '../../../src/config/environment.js';
import { CAMERA_DEFAULTS, WORLD_HALF } from '../../../src/game/config.js';
import { BloomProvider, useBloomContext } from '../../../src/renderer/bloom/index.js';
import { StarLight } from '../../../src/components/environment/StarLight.js';
import { StarSphere } from '../../../src/components/environment/StarSphere.js';

const mockCamera = {
  position: new Vector3(0, 600, 1600),
  rotation: { x: 0, y: 0, z: 0 },
  projectionMatrix: new Matrix4().makePerspective(-1, 1, 1, -1, 0.1, 80000),
  matrixWorldInverse: new Matrix4().makeTranslation(0, -600, -1600),
  updateMatrixWorld: vi.fn(),
};

vi.mock('@react-three/drei', () => ({
  Environment: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  Lightformer: () => null,
}));

vi.mock('@react-three/fiber', () => ({
  useThree: () => ({
    gl: { getContext: () => null, domElement: { width: 1280, height: 720 } },
    camera: mockCamera,
    size: { width: 1280, height: 720 },
  }),
  useFrame: vi.fn(),
}));

vi.mock('../../../src/hooks/useStarTextures.js', () => ({
  useStarTextures: () => ({ organic: null, noise: null }),
}));

vi.mock('../../../src/hooks/usePrefersReducedMotion.js', () => ({
  usePrefersReducedMotion: () => false,
}));

function parseGroupPosition(el: Element): [number, number, number] {
  const raw = el.getAttribute('position');
  expect(raw).toBeTruthy();
  const parts = raw!.split(',').map(Number);
  expect(parts).toHaveLength(3);
  return [parts[0]!, parts[1]!, parts[2]!];
}

describe('StarSphere placement and bloom registration', () => {
  const origCreateElement = document.createElement.bind(document);

  beforeEach(() => {
    vi.clearAllMocks();
    // Provide minimal Three.js DirectionalLight shadow fields on the happy-dom
    // <directionallight> element so real StarLight mounts without mocking it.
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string, options?: unknown) => {
      const el = origCreateElement(tagName, options as ElementCreationOptions);
      if (tagName.toLowerCase() === 'directionallight') {
        Object.assign(el, {
          shadow: {
            mapSize: { set: vi.fn() },
            needsUpdate: false,
            bias: 0,
            normalBias: 0,
            camera: {
              near: 0,
              far: 0,
              left: 0,
              right: 0,
              top: 0,
              bottom: 0,
              updateProjectionMatrix: vi.fn(),
            },
          },
        });
      }
      return el;
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('does not double-offset beneath StarLight when distanceMultiplier is 1', () => {
    const { starLight, starDisk, skysphere } = CELESTIAL_ENVIRONMENT;
    const stubMaterial = new ShaderMaterial();

    const { container } = render(
      <StarLight config={starLight}>
        <StarSphere
          config={starLight}
          size={starDisk?.size}
          opacity={starDisk?.opacity}
          distanceMultiplier={starDisk?.distanceMultiplier}
          materialOverride={stubMaterial}
          enableAlphaToCoverage={false}
        />
      </StarLight>,
    );

    const groups = container.querySelectorAll('group');
    expect(groups).toHaveLength(2);

    const starLightPos = parseGroupPosition(groups[0]!);
    const starSphereLocalPos = parseGroupPosition(groups[1]!);

    // StarSphere's local group must sit at the StarLight origin (no duplicate -dir * distance).
    expect(starSphereLocalPos).toEqual([0, 0, 0]);

    const worldCenter = new Vector3(
      starLightPos[0] + starSphereLocalPos[0],
      starLightPos[1] + starSphereLocalPos[1],
      starLightPos[2] + starSphereLocalPos[2],
    );
    const dir = new Vector3(
      starLight.direction.x,
      starLight.direction.y,
      starLight.direction.z,
    ).normalize();
    const expectedWorldCenter = dir.clone().multiplyScalar(-starLight.distance);

    expect(worldCenter.distanceTo(expectedWorldCenter)).toBeLessThan(1e-3);

    // Center and entire star sphere stay outside the combat arena, inside Skysphere, and within camera.far.
    const centerDistance = worldCenter.length();
    const starRadius = starDisk?.size ?? 0;
    expect(centerDistance).toBeCloseTo(starLight.distance, 3);
    expect(centerDistance - starRadius).toBeGreaterThan(WORLD_HALF);
    expect(centerDistance + starRadius).toBeLessThan(skysphere!.radius!);
    expect(centerDistance + starRadius).toBeLessThan(CAMERA_DEFAULTS.far);

    stubMaterial.dispose();
  });

  it('defaults omitted distanceMultiplier to 1 so standalone config matches StarLight distance', () => {
    const { starLight } = CELESTIAL_ENVIRONMENT;
    const stubMaterial = new ShaderMaterial();

    const { container } = render(
      <StarLight config={starLight}>
        <StarSphere
          config={starLight}
          materialOverride={stubMaterial}
          enableAlphaToCoverage={false}
        />
      </StarLight>,
    );

    const groups = container.querySelectorAll('group');
    expect(groups).toHaveLength(2);
    expect(parseGroupPosition(groups[1]!)).toEqual([0, 0, 0]);

    stubMaterial.dispose();
  });

  it('applies only the relative delta when distanceMultiplier differs from 1', () => {
    const { starLight } = CELESTIAL_ENVIRONMENT;
    const stubMaterial = new ShaderMaterial();

    const { container } = render(
      <StarLight config={starLight}>
        <StarSphere
          config={starLight}
          distanceMultiplier={0.8}
          materialOverride={stubMaterial}
          enableAlphaToCoverage={false}
        />
      </StarLight>,
    );

    const groups = container.querySelectorAll('group');
    expect(groups).toHaveLength(2);

    const starLightPos = parseGroupPosition(groups[0]!);
    const starSphereLocalPos = parseGroupPosition(groups[1]!);

    const worldCenter = new Vector3(
      starLightPos[0] + starSphereLocalPos[0],
      starLightPos[1] + starSphereLocalPos[1],
      starLightPos[2] + starSphereLocalPos[2],
    );
    const dir = new Vector3(
      starLight.direction.x,
      starLight.direction.y,
      starLight.direction.z,
    ).normalize();
    const expectedWorldCenter = dir.clone().multiplyScalar(-starLight.distance * 0.8);

    expect(worldCenter.distanceTo(expectedWorldCenter)).toBeLessThan(1e-3);

    stubMaterial.dispose();
  });

  it('does not allocate or register an unused star bloom selection inside BloomProvider', () => {
    const stubMaterial = new ShaderMaterial();
    let capturedCtx: ReturnType<typeof useBloomContext> = null;

    function ContextProbe(): null {
      capturedCtx = useBloomContext();
      return null;
    }

    render(
      <BloomProvider enabled={true}>
        <ContextProbe />
        <StarLight config={CELESTIAL_ENVIRONMENT.starLight}>
          <StarSphere
            config={CELESTIAL_ENVIRONMENT.starLight}
            materialOverride={stubMaterial}
            enableAlphaToCoverage={false}
          />
        </StarLight>
      </BloomProvider>,
    );

    expect(capturedCtx).not.toBeNull();
    expect(capturedCtx!.selections.has('star')).toBe(false);
    for (const selection of capturedCtx!.selections.values()) {
      expect(selection.size).toBe(0);
    }

    stubMaterial.dispose();
  });
});
