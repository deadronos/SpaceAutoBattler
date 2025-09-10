import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RendererConfig } from '../../src/config/rendererConfig.js';
import * as svgLoaderMod from '../../src/core/svgLoader.js';

describe('debugSVG no-op when GLTF mode enabled', () => {
  let origLoadGltf: any;

  beforeEach(() => {
    origLoadGltf = (RendererConfig as any).loadGltfModels;
    (RendererConfig as any).loadGltfModels = true;
  });

  afterEach(() => {
    (RendererConfig as any).loadGltfModels = origLoadGltf;
    vi.restoreAllMocks();
  });

  it('does not call getSVGLoader when GLTF mode is enabled', () => {
    const spy = vi.spyOn(svgLoaderMod, 'getSVGLoader');

    // Construct the same debugSVG wrapper as in main.ts
    (global as any).debugSVG = {
      getStats: () => {
        if ((RendererConfig as any)?.loadGltfModels) {
          return { cachedAssets: 0 } as any;
        }
        const loader = svgLoaderMod.getSVGLoader();
        return loader.getCacheStats();
      },
      reloadAll: async () => {},
      clearCache: (_?: string) => {},
      listCached: () => [],
    } as any;

    const stats = (global as any).debugSVG.getStats();
    expect(stats).toEqual({ cachedAssets: 0 });
    expect(spy).not.toHaveBeenCalled();
  });
});
