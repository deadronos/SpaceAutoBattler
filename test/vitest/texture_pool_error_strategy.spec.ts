import { describe, it, expect } from 'vitest';
import { acquireTexture, releaseTexture } from '../../src/pools';
import { makeDeterministicState } from './utils/stateFixture';

describe('texture pool error strategy', () => {
  it('throws when strategy is error and pool is exhausted', () => {
    const state: any = makeDeterministicState();
    state.assetPool.config.texturePoolSize = 1;
    state.assetPool.config.textureOverflowStrategy = 'error';
    const key = 'errorkey';
    function create() {
      return { id: Math.random() } as unknown as WebGLTexture;
    }
    const t1 = acquireTexture(state, key, create);
    // acquiring another when max reached should throw because strategy is 'error'
    let thrown = false;
    try {
      acquireTexture(state, key, create);
    } catch (e) {
      thrown = true;
    }
    expect(thrown).toBe(true);
    // cleanup
    releaseTexture(state, key, t1, () => {});
  });
});
