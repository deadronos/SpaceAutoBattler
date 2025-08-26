import { describe, it, expect } from 'vitest';
import { ensureAssetPool, acquireTexture, releaseTexture } from '../../src/pools';

describe('assetPool internals', () => {
  it('ensureAssetPool creates a valid assetPool shape', () => {
    const state: any = {};
    ensureAssetPool(state);
    expect(state.assetPool).toBeDefined();
    expect(state.assetPool.textures).toBeInstanceOf(Map);
    expect(state.assetPool.sprites).toBeInstanceOf(Map);
    expect(state.assetPool.effects).toBeInstanceOf(Map);
    expect(state.assetPool.counts).toBeDefined();
  });

  it('acquireTexture/releaseTexture roundtrip and counts update', () => {
    const state: any = {};
    const createFn = () => ({ id: Math.random() } as unknown as WebGLTexture);
    const tex = acquireTexture(state, 'key1', createFn);
    expect(tex).toBeDefined();
    // release back
    releaseTexture(state, 'key1', tex);
    const entry = state.assetPool.textures.get('key1');
    expect(entry).toBeDefined();
    expect(entry.freeList.length).toBeGreaterThanOrEqual(1);
  });
});
