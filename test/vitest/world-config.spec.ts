import { describe, it, expect } from 'vite-plus/test';
import {
  WORLD_SIZE,
  WORLD_HALF,
  WORLD_BOUNDS_MARGIN,
  clampToWorld,
} from '../../src/game/config.js';

describe('world config and clamping', () => {
  it('has consistent halves and margins', () => {
    expect(WORLD_HALF).toBe(WORLD_SIZE / 2);
    expect(typeof WORLD_BOUNDS_MARGIN).toBe('number');
    expect(WORLD_BOUNDS_MARGIN).toBeGreaterThanOrEqual(0);
  });

  it('clamps vector components to within world cube', () => {
    const min = -WORLD_HALF + WORLD_BOUNDS_MARGIN;
    const max = WORLD_HALF - WORLD_BOUNDS_MARGIN;

    const v = { x: min - 100, y: 0, z: max + 500 };
    clampToWorld(v);
    expect(v.x).toBeCloseTo(min, 6);
    expect(v.z).toBeCloseTo(max, 6);
    // y was inside already
    expect(v.y).toBe(0);
  });

  it('does not change vectors already inside bounds', () => {
    const v = { x: 0, y: 1, z: -2 };
    clampToWorld(v);
    expect(v).toEqual({ x: 0, y: 1, z: -2 });
  });
});
