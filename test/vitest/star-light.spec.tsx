import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { DirectionalLight } from 'three';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { CELESTIAL_ENVIRONMENT, type StarLightConfig } from '../../src/config/environment.js';
import { StarLight } from '../../src/components/environment/StarLight.js';

const environmentCalls = vi.hoisted(() => [] as Array<Record<string, unknown>>);
const lightformerCalls = vi.hoisted(() => [] as Array<Record<string, unknown>>);

vi.mock('@react-three/drei', () => ({
  Environment: (props: Record<string, unknown> & { children?: React.ReactNode }) => {
    const { children, ...rest } = props;
    environmentCalls.push(rest);
    return <>{children}</>;
  },
  Lightformer: (props: Record<string, unknown>) => {
    lightformerCalls.push(props);
    return null;
  },
}));

vi.mock('../../src/app/uiStore.js', () => ({
  useUiStore: (selector: (s: { qualityPreset: 'high'; detectedQualityTier: 'high' }) => unknown) =>
    selector({ qualityPreset: 'high', detectedQualityTier: 'high' }),
}));

beforeEach(() => {
  environmentCalls.length = 0;
  lightformerCalls.length = 0;
});

function createNodeMock(element: React.ReactElement): unknown {
  if (element.type === 'directionalLight') {
    return new DirectionalLight();
  }
  return null;
}

describe('StarLight lighting rig (Issue #741)', () => {
  it('renders key light, opposite cool fill light without shadows, and procedural Environment IBL', () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(<StarLight config={CELESTIAL_ENVIRONMENT.starLight} />, {
        createNodeMock,
      });
    });

    const lights = renderer.root.findAllByType('directionalLight');
    expect(lights).toHaveLength(2);

    // First directional light is the opposite fill/rim light (no shadow casting).
    const fillLight = lights[0]!;
    const keyLight = lights[1]!;
    expect(fillLight.props.castShadow).toBe(false);
    expect(fillLight.props.color).toBe(CELESTIAL_ENVIRONMENT.starLight.fillColor);
    expect(fillLight.props.intensity).toBeCloseTo(
      CELESTIAL_ENVIRONMENT.starLight.fillIntensity ?? 0.3,
    );
    expect(keyLight.props.color).toBe(CELESTIAL_ENVIRONMENT.starLight.color);
    expect(keyLight.props.castShadow).toBe(true);

    // Opposite fill light sits on the +direction side opposite the key light group (-direction).
    const { direction, distance } = CELESTIAL_ENVIRONMENT.starLight;
    const len = Math.hypot(direction.x, direction.y, direction.z);
    const expectedFill = [
      (direction.x / len) * distance,
      (direction.y / len) * distance,
      (direction.z / len) * distance,
    ];
    const actualFill = fillLight.props.position as [number, number, number];
    expect(actualFill[0]).toBeCloseTo(expectedFill[0]!, 3);
    expect(actualFill[1]).toBeCloseTo(expectedFill[1]!, 3);
    expect(actualFill[2]).toBeCloseTo(expectedFill[2]!, 3);

    // Procedural <Environment> with <Lightformer>s avoids external HDR network fetches.
    expect(environmentCalls).toHaveLength(1);
    expect(environmentCalls[0]).toMatchObject({
      resolution: 64,
      frames: 1,
      environmentIntensity: CELESTIAL_ENVIRONMENT.starLight.environmentIntensity,
    });
    expect(environmentCalls[0]).not.toHaveProperty('preset');
    expect(environmentCalls[0]).not.toHaveProperty('files');
    expect(lightformerCalls.length).toBeGreaterThanOrEqual(2);
  });

  it('omits fill light and Environment when intensities are zero', () => {
    const customConfig: StarLightConfig = {
      ...CELESTIAL_ENVIRONMENT.starLight,
      fillIntensity: 0,
      environmentIntensity: 0,
    };

    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(<StarLight config={customConfig} />, { createNodeMock });
    });

    expect(renderer.root.findAllByType('directionalLight')).toHaveLength(1);
    expect(environmentCalls).toHaveLength(0);
    expect(lightformerCalls).toHaveLength(0);
  });
});
