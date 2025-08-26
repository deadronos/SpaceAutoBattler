import { describe, it, expect } from 'vitest';
import { acquireTexture, releaseTexture } from '../../src/pools';
import { makeDeterministicState } from './utils/stateFixture';

describe('texture pool entry disposer', () => {
  it('uses entry.disposer when set instead of disposeFn', () => {
    const state: any = makeDeterministicState();
    state.assetPool.config.texturePoolSize = 1;
    state.assetPool.config.textureOverflowStrategy = 'discard-oldest';
    const key = 'entrydisposer';
    const created: any[] = [];
    const disposed: any[] = [];
    function create() {
      const t = { id: Math.random() } as any;
      created.push(t);
      return t as unknown as WebGLTexture;
    }
    // create entry with disposer
    const entry = { freeList: [], allocated: 0, disposer: (x: any) => disposed.push(x) };
    state.assetPool.textures.set(key, entry as any);

    const t1 = acquireTexture(state, key, create);
    const t2 = acquireTexture(state, key, create);
    releaseTexture(state, key, t1, () => { throw new Error('should not be used'); });
    releaseTexture(state, key, t2, () => { throw new Error('should not be used'); });

    expect(disposed.length).toBeGreaterThanOrEqual(1);
  });
});
