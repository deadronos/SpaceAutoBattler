import { describe, it, expect, beforeEach } from "vitest";
import { makeInitialState, acquireEffect, releaseEffect, createPooledFactory, makePooled } from "../../src/entities";

describe("Pooled factory helper", () => {
  let state: any;
  beforeEach(() => {
    state = makeInitialState();
  });

  it("prevents double-free in effect pool", () => {
    const key = "edgecase";
    const factory = createPooledFactory(() => ({ x: 0, alive: true }));
    const e1 = acquireEffect(state, key, () => factory.create());
    releaseEffect(state, key, e1);
  const poolLen = (state.assetPool.effects.get(key)?.freeList || []).length;
  releaseEffect(state, key, e1);
  expect((state.assetPool.effects.get(key)?.freeList || []).length).toBe(poolLen);
  });

  it("enforces pool capacity and disposes extras", () => {
    const key = "captest";
    let disposed: any[] = [];
    const factory = createPooledFactory(() => ({ x: 0, alive: true }));
    // Set pool size to 2 for this test
    state.assetPool.config.effectPoolSize = 2;
    const objs: any[] = [];
    for (let i = 0; i < 4; ++i) {
      objs.push(acquireEffect(state, key, () => factory.create()));
    }
    // Release all at once to exceed pool size
    for (const e of objs) releaseEffect(state, key, e, (obj) => disposed.push(obj));
  expect((state.assetPool.effects.get(key)?.freeList || []).length).toBe(2);
    expect(disposed.length).toBe(2);
  });

  it("supports error strategy for pool overflow", () => {
    const key = "errortest";
    state.assetPool.config.effectPoolSize = 1;
    state.assetPool.config.effectOverflowStrategy = "error";
    const factory = createPooledFactory(() => ({ x: 0, alive: true }));
    acquireEffect(state, key, () => factory.create());
    expect(() => acquireEffect(state, key, () => factory.create())).toThrow();
    // Reset strategy for other tests
    state.assetPool.config.effectOverflowStrategy = "discard-oldest";
  });

  it("handles large churn scenarios", () => {
    const key = "churn";
    state.assetPool.config.effectPoolSize = 8;
    const factory = createPooledFactory(() => ({ x: 0, alive: true }));
    const objs: any[] = [];
    for (let i = 0; i < 16; ++i) {
      const e = acquireEffect(state, key, () => factory.create(), { x: i });
      objs.push(e);
    }
    // Release all
    for (const e of objs) releaseEffect(state, key, e);
  expect((state.assetPool.effects.get(key)?.freeList || []).length).toBe(8);
    // Re-acquire and check reset
    for (let i = 0; i < 8; ++i) {
      const e = acquireEffect(state, key, () => factory.create(), { x: 100 + i });
      expect(e.x).toBe(100 + i);
    }
  });

  it("allows authoring factories with reset function and rehydrates on reuse", () => {
    const key = "pfx";
    // Create a factory that returns plain objects and provides a reset that sets x/y
    const factory = createPooledFactory(() => ({ x: 0, y: 0, alive: true }), (o: any, initArgs?: any) => {
      o.x = initArgs?.x ?? 0;
      o.y = initArgs?.y ?? 0;
      o.alive = true;
    });

    // Acquire one using the factory
    const e1 = acquireEffect(state, key, () => {
      // create via factory and attach pooled reset (makePooled is used by pooling infra too)
      return makePooled(factory.create(), factory.reset);
    }, { x: 10, y: 20 });

    expect(e1.x).toBe(10);
    expect(e1.y).toBe(20);

    // Release and then acquire again with different initArgs -> should reuse and be reset
    releaseEffect(state, key, e1);
    const e2 = acquireEffect(state, key, () => makePooled(factory.create(), factory.reset), { x: 30, y: 40 });
    // Should be same reference (reused)
    expect(e2).toBe(e1);
    expect(e2.x).toBe(30);
    expect(e2.y).toBe(40);
  });

  it("works without explicit reset when initArgs is object (shallow assign)", () => {
    const key = "pfx2";
    const factory = createPooledFactory(() => ({ a: 1, b: 2 }));
    const e1 = acquireEffect(state, key, () => factory.create(), { a: 9, b: 8 });
    expect(e1.a).toBe(9);
    releaseEffect(state, key, e1);
    const e2 = acquireEffect(state, key, () => factory.create(), { a: 5 });
    expect(e2).toBe(e1);
    // Since no reset was provided, pooling infra will shallow-assign initArgs
    expect(e2.a).toBe(5);
  });
});
