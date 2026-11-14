import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it } from 'vite-plus/test';
import { WORLD_HALF } from '../../src/game/config.js';
import {
  STAR_FIELD_COUNT,
  STAR_FIELD_MAX_RADIUS,
  STAR_FIELD_MIN_RADIUS,
  StarsField,
  generateStarPositions,
} from '../../src/components/layers/StarsField.js';

describe('StarsField distribution and rendering', () => {
  it('generates deterministic positions for the configured star count', () => {
    const first = generateStarPositions();
    const second = generateStarPositions();

    expect(first).toBeInstanceOf(Float32Array);
    expect(first.length).toBe(STAR_FIELD_COUNT * 3);
    expect(Array.from(first)).toEqual(Array.from(second));
  });

  it('places every star outside the inner arena and within the outer shell', () => {
    const positions = generateStarPositions();

    expect(STAR_FIELD_MIN_RADIUS).toBeGreaterThan(WORLD_HALF);
    for (let i = 0; i < STAR_FIELD_COUNT; i += 1) {
      const x = positions[i * 3]!;
      const y = positions[i * 3 + 1]!;
      const z = positions[i * 3 + 2]!;
      const radius = Math.hypot(x, y, z);

      expect(radius).toBeGreaterThanOrEqual(STAR_FIELD_MIN_RADIUS - 1e-3);
      expect(radius).toBeLessThanOrEqual(STAR_FIELD_MAX_RADIUS + 1e-3);
    }
  });

  it('distributes stars symmetrically across both hemispheres and all octants', () => {
    const positions = generateStarPositions();
    let positiveY = 0;
    let negativeY = 0;
    const octantCounts = new Array<number>(8).fill(0);

    for (let i = 0; i < STAR_FIELD_COUNT; i += 1) {
      const x = positions[i * 3]!;
      const y = positions[i * 3 + 1]!;
      const z = positions[i * 3 + 2]!;

      if (y >= 0) positiveY += 1;
      else negativeY += 1;

      const octant = (x >= 0 ? 1 : 0) | (y >= 0 ? 2 : 0) | (z >= 0 ? 4 : 0);
      octantCounts[octant]! += 1;
    }

    // Out of 3500 isotropic samples, each hemisphere should hold ~1750 stars.
    expect(positiveY).toBeGreaterThan(1550);
    expect(negativeY).toBeGreaterThan(1550);

    // Each octant (~437 expected) should be well populated.
    for (const count of octantCounts) {
      expect(count).toBeGreaterThan(320);
      expect(count).toBeLessThan(560);
    }
  });

  it('disables scene fog on the StarsField pointsMaterial', () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(<StarsField />);
    });
    const mat = renderer.root.findByType('pointsMaterial');
    expect(mat.props.fog).toBe(false);
  });
});
