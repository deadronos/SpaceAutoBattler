# asset_loader_api

```
import type { GameState } from '../types/index.js';
import LRUAssetPool from './assetPool.js';
// AssetLoader scaffold: wraps three's GLTFLoader and caches in GameState.assetPool if present.

// Note: this file uses dynamic imports to avoid bundling three/examples heavy code at module eval.

export type AssetHandle = {
  url: string;
  data: any;
};

export async function loadGLTF(state: GameState, url: string): Promise<AssetHandle> {
  // Check cache
  try {
    const pool = (state as any).assetPool as Map<string, any> | undefined;
    if (pool) {
      const cached = pool.get(url);
      if (cached) return { url, data: cached };
    }
  } catch (e) {
```

> Auto-generated stub — please review and expand.
