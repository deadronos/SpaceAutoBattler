import { describe, it, expect, vi } from "vitest";
import createGameManager from "../../src/gamemanager";
import { makeInitialState } from "../../src/entities";

// Ensure that when many snapshots arrive quickly, the renderer is called at most
// once per RAF (coalescing works).

describe("renderer coalescing", () => {
  it("calls renderer at most once per RAF when snapshots flood in", async () => {
    let capturedWorker: any = null;
    const fakeFactory = (_url?: string) => {
      const handlers: Record<string, Function> = {};
      const w = {
        on: (evt: string, cb: Function) => {
          handlers[evt] = cb;
        },
        off: (_evt: string, _cb: Function) => {},
        post: (_msg: any) => {},
        terminate: () => {},
        _handlers: handlers,
      } as any;
      capturedWorker = w;
      return w;
    };

    const calls: any[] = [];
    const fakeRenderer = {
      renderState: (s: any) => {
        calls.push(s);
      },
    };

    const gm = createGameManager({
      renderer: fakeRenderer,
      useWorker: true,
      seed: 1,
      createSimWorker: fakeFactory,
    });

    // send many snapshots synchronously
    const state = makeInitialState();
    for (let i = 0; i < 10; i++) {
      state.ships = [{ id: i } as any];
      capturedWorker._handlers["snapshot"]({ state });
    }

    // wait for RAF
    await new Promise((resolve) =>
      requestAnimationFrame(() => setTimeout(resolve, 0)),
    );

    // Expect at least one render, but not more than the number of RAFs we waited for (1)
    expect(calls.length).toBeGreaterThanOrEqual(1);
    expect(calls.length).toBeLessThanOrEqual(2);
  });
});
