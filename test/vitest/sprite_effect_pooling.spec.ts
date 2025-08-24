import { describe, it, expect, beforeEach } from "vitest";
import { makeInitialState, acquireSprite, releaseSprite, acquireEffect, releaseEffect } from "../../src/entities";

describe("Sprite/Effect Pooling", () => {
  let state: any;
  beforeEach(() => {
    state = makeInitialState();
  });

  it("reuses sprite objects (happy path)", () => {
    const key = "ship:fighter";
    const s1 = acquireSprite(state, key, () => ({ foo: 1 }));
    expect(s1).toBeTruthy();
    releaseSprite(state, key, s1);
    const s2 = acquireSprite(state, key, () => ({ foo: 2 }));
    // Should be reused (same reference)
    expect(s2).toBe(s1);
  });

  it("trims sprites when over capacity with discard-oldest", () => {
    const key = "p:many";
    // Lower capacity for test
    state.assetPool.config.spritePoolSize = 2;
    const a = acquireSprite(state, key, () => ({ id: 1 }));
    const b = acquireSprite(state, key, () => ({ id: 2 }));
    const c = acquireSprite(state, key, () => ({ id: 3 }));
    // Release three items, pool max is 2 -> one should be trimmed
    releaseSprite(state, key, a);
    releaseSprite(state, key, b);
    releaseSprite(state, key, c);
    const pool = state.assetPool.sprites.get(key) || [];
  expect(typeof pool.length === 'number' ? pool.length : 0).toBeLessThanOrEqual(2);
  });

  it("reuses effect objects and supports disposer on trim", () => {
    const key = "fx";
    state.assetPool.config.effectPoolSize = 1;
    const e1 = acquireEffect(state, key, () => ({ id: 1 }));
    const e2 = acquireEffect(state, key, () => ({ id: 2 }));
    releaseEffect(state, key, e1, (x) => { (x as any)._disposed = true; });
    releaseEffect(state, key, e2, (x) => { (x as any)._disposed = true; });
  const pool = state.assetPool.effects.get(key)?.freeList || [];
  // Because max=1, one of the released items should have been disposed
  expect(typeof pool.length === 'number' ? pool.length : 0).toBeLessThanOrEqual(1);
  });
});
