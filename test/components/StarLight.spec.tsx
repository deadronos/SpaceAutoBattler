import { describe, expect, it, vi } from 'vite-plus/test';
import { DirectionalLight, Object3D, OrthographicCamera, Vector2 } from 'three';
import { applyStarLightShadowSettings } from '../../src/components/environment/StarLight.js';

describe('applyStarLightShadowSettings', () => {
  it('disposes stale shadow.map and clears it when shadowMapSize changes without remounting', () => {
    const mapDispose = vi.fn();
    const depthDispose = vi.fn();
    const fakeShadowMap = {
      width: 2048,
      height: 2048,
      dispose: mapDispose,
      depthTexture: { dispose: depthDispose },
    };

    const light = {
      target: null,
      castShadow: true,
      shadow: {
        mapSize: new Vector2(2048, 2048),
        needsUpdate: false,
        bias: 0,
        normalBias: 0,
        camera: new OrthographicCamera(-1, 1, 1, -1, 0.1, 100),
        map: fakeShadowMap,
      },
    } as unknown as DirectionalLight;
    const target = new Object3D();

    // Same size: keep existing shadow map alive.
    applyStarLightShadowSettings(light, target, 1000, true, 2048);
    expect(mapDispose).not.toHaveBeenCalled();
    expect(light.shadow.map).toBe(fakeShadowMap);

    // Different size (e.g. quality tier switched high -> medium): dispose & null so Three reallocates.
    applyStarLightShadowSettings(light, target, 1000, true, 1024);
    expect(depthDispose).toHaveBeenCalledTimes(1);
    expect(mapDispose).toHaveBeenCalledTimes(1);
    expect(light.shadow.map).toBeNull();
    expect(light.shadow.mapSize.x).toBe(1024);
    expect(light.shadow.mapSize.y).toBe(1024);
    expect(light.shadow.needsUpdate).toBe(true);
  });
});
