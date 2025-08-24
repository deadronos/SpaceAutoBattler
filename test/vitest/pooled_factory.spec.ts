import { describe, it, expect, beforeEach } from "vitest";
import { makeInitialState, acquireEffect, releaseEffect, createPooledFactory, makePooled } from "../../src/entities";

describe("Pooled factory helper", () => {
  let state: any;
  beforeEach(() => {
    state = makeInitialState();
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
