import { describe, it, expect } from 'vitest';
import { makeInitialState } from '../../src/entities';
import { acquireSprite, releaseSprite, acquireEffect, releaseEffect } from '../../src/pools';

describe('Pooling stress test', () => {
  it('handles high churn across many keys without unbounded growth', () => {
    const state = makeInitialState();
    state.assetPool.config.spritePoolSize = 10;
    state.assetPool.config.effectPoolSize = 10;
    const keys: string[] = [];
    for (let i = 0; i < 200; i++) keys.push('k' + i);

    for (let iter = 0; iter < 500; iter++) {
      // Randomly pick 50 keys and churn
      for (let j = 0; j < 50; j++) {
        const key = keys[Math.floor(Math.random() * keys.length)];
        const s = acquireSprite(state, key, () => ({ foo: key }));
        releaseSprite(state, key, s);
        const e = acquireEffect(state, key, () => ({ foo: key }));
        releaseEffect(state, key, e);
      }
    }

    // Check that free lists are not excessively large
    let maxSprite = 0;
    for (const [k, entry] of state.assetPool.sprites.entries()) {
      maxSprite = Math.max(maxSprite, entry?.freeList?.length ?? 0);
    }
    let maxEffect = 0;
    for (const [k, entry] of state.assetPool.effects.entries()) {
      maxEffect = Math.max(maxEffect, entry?.freeList?.length ?? 0);
    }
    expect(maxSprite).toBeLessThanOrEqual(20);
    expect(maxEffect).toBeLessThanOrEqual(20);
  });
});
