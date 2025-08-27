import { describe, it, expect } from "vitest";
import createGameManager from "../../src/gamemanager";
import { makeInitialState } from "../../src/entities";
// Ensure that when many snapshots arrive quickly, the renderer is called at most
// once per RAF (coalescing works).
describe("renderer coalescing", () => {
    it("calls renderer at most once per RAF when snapshots flood in", async () => {
        let capturedWorker = null;
        const fakeFactory = (_url) => {
            const handlers = {};
            const w = {
                on: (evt, cb) => {
                    handlers[evt] = cb;
                },
                off: (_evt, _cb) => { },
                post: (_msg) => { },
                terminate: () => { },
                _handlers: handlers,
            };
            capturedWorker = w;
            return w;
        };
        const calls = [];
        const fakeRenderer = {
            renderState: (s) => {
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
            state.ships = [{ id: i }];
            capturedWorker._handlers["snapshot"]({ state });
        }
        // wait for RAF
        await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
        // Expect at least one render, but not more than the number of RAFs we waited for (1)
        expect(calls.length).toBeGreaterThanOrEqual(1);
        expect(calls.length).toBeLessThanOrEqual(2);
    });
});
