import { describe, expect, it } from 'vite-plus/test';
import {
  computeShadowCameraParams,
  DEFAULT_SHADOW_FRUSTUM_RADIUS,
} from '../../src/renderer/shadowCamera.js';

describe('computeShadowCameraParams', () => {
  it('brackets the action with a tight ortho frustum instead of the whole world', () => {
    const params = computeShadowCameraParams(30000);

    expect(params.halfSize).toBe(DEFAULT_SHADOW_FRUSTUM_RADIUS);
    expect(params.halfSize).toBeLessThan(8000);
    expect(params.far).toBeGreaterThan(params.near);
    expect(params.near).toBe(30000 - DEFAULT_SHADOW_FRUSTUM_RADIUS * 2);
    expect(params.far).toBe(30000 + DEFAULT_SHADOW_FRUSTUM_RADIUS * 2);
  });

  it('clamps degenerate inputs', () => {
    const params = computeShadowCameraParams(0, 0);

    expect(params.halfSize).toBeGreaterThanOrEqual(1);
    expect(params.near).toBeGreaterThanOrEqual(1);
    expect(params.far).toBeGreaterThan(params.near);
  });
});
