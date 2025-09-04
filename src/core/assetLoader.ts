import type { GameState } from '../types/index.js';
import _LRUAssetPool from './assetPool.js';
// AssetLoader scaffold: wraps three's GLTFLoader and caches in GameState.assetPool if present.

// Note: this file uses dynamic imports to avoid bundling three/examples heavy code at module eval.

export type AssetHandle = {
  url: string;
  data: unknown;
};

export async function loadGLTF(state: GameState, url: string): Promise<AssetHandle> {
  // Check cache
  try {
  const pool = (state as unknown as { assetPool?: Map<string, unknown> }).assetPool;
    if (pool) {
      const cached = pool.get(url);
      if (cached) return { url, data: cached };
    }
  } catch (e) { void e; void e; /* ignore */ }

  // Lazy-load three GLTF loader to keep startup light
  const mod = await import('three/examples/jsm/loaders/GLTFLoader.js');
  // GLTFLoader from three may have complex typings; treat as unknown constructor to avoid `any`.
  const GLTFLoaderCtor = (mod as unknown as { GLTFLoader: new () => unknown }).GLTFLoader as unknown as new () => { load: (url: string, onLoad: (gltf: unknown) => void, onProgress?: unknown, onError?: (err: unknown) => void) => void };
  const loader = new GLTFLoaderCtor();

  return new Promise((resolve, reject) => {
    try {
  loader.load(url, (gltf: unknown) => {
        // store in pool if available
        try {
          const pool2 = (state as unknown as { assetPool?: Map<string, unknown> }).assetPool;
          if (pool2) pool2.set(url, gltf);
        } catch (e) { void e; void e; /* ignore */ }
        resolve({ url, data: gltf });
  }, undefined, (err: unknown) => reject(err as Error));
    } catch (e) { void e;reject(e);
    }
  });
}

