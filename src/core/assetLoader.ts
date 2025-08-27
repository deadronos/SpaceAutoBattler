import type { GameState } from '../types/index.js';
// AssetLoader scaffold: wraps three's GLTFLoader and caches in GameState.assetPool if present.

// Note: this file uses dynamic imports to avoid bundling three/examples heavy code at module eval.

export type AssetHandle = {
  url: string;
  data: any;
};

export async function loadGLTF(state: GameState, url: string): Promise<AssetHandle> {
  // Check cache
  try {
    const pool = (state as any).assetPool;
    if (pool && pool.get) {
      const cached = pool.get(url);
      if (cached) return { url, data: cached };
    }
  } catch (e) {
    // ignore
  }

  // Lazy-load three GLTF loader to keep startup light
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { GLTFLoader } = require('three/examples/jsm/loaders/GLTFLoader') as any;
  const loader = new GLTFLoader();

  return new Promise((resolve, reject) => {
    try {
      loader.load(url, (gltf: any) => {
        // store in pool if available
        try {
          const pool = (state as any).assetPool;
          if (pool && pool.set) pool.set(url, gltf);
        } catch (e) { /* ignore */ }
        resolve({ url, data: gltf });
      }, undefined, (err: any) => reject(err));
    } catch (e) {
      reject(e);
    }
  });
}
