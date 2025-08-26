import type { PoolEntry, TexturePoolEntry } from './types/pool';

// Central helper to ensure a GameState has the assetPool shape used by pooling helpers
// We import pool types as `type` only to avoid emitting runtime imports and
// thus avoid possible circular runtime dependencies.
export function ensureAssetPool(state: any): void {
  if (!state) return;
  if (!state.assetPool || typeof state.assetPool !== 'object') {
    state.assetPool = {
      textures: new Map<string, TexturePoolEntry>(),
      sprites: new Map<string, PoolEntry<any>>(),
      effects: new Map<string, PoolEntry<any>>(),
      counts: {
        textures: new Map<string, number>(),
        sprites: new Map<string, number>(),
        effects: new Map<string, number>(),
      },
      config: {
        texturePoolSize: 128,
        spritePoolSize: 256,
        effectPoolSize: 128,
        textureOverflowStrategy: 'discard-oldest',
        spriteOverflowStrategy: 'discard-oldest',
        effectOverflowStrategy: 'discard-oldest',
      },
    } as any;
  } else {
    state.assetPool.textures = state.assetPool.textures || new Map();
    state.assetPool.sprites = state.assetPool.sprites || new Map();
    state.assetPool.effects = state.assetPool.effects || new Map();
    state.assetPool.counts = state.assetPool.counts || {
      textures: new Map(),
      sprites: new Map(),
      effects: new Map(),
    };
    state.assetPool.config = state.assetPool.config || {
      texturePoolSize: 128,
      spritePoolSize: 256,
      effectPoolSize: 128,
      textureOverflowStrategy: 'discard-oldest',
      spriteOverflowStrategy: 'discard-oldest',
      effectOverflowStrategy: 'discard-oldest',
    };
  }
}

export default ensureAssetPool;
