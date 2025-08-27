import { describe, it, expect } from "vitest";
import createGameManager from "../../src/gamemanager";
import { makeInitialState, createShip } from "../../src/entities";
// Regression test: when the simulation runs in a worker, the manager should
// render the fresh snapshot the worker posts; this test fakes a worker factory
// and captures its handlers to simulate snapshot messages and verifies the
// renderer's renderState receives the worker snapshot.
describe("Worker snapshot -> renderer integration", () => {
    it("renders worker snapshots (coalesced to RAF)", async () => {
        // Capture fake worker and handlers
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
        // Build a fake renderer that spies on renderState
        const calls = [];
        const fakeRenderer = {
            renderState: (s) => {
                calls.push(s);
            },
        };
        const gm = createGameManager({
            renderer: fakeRenderer,
            useWorker: true,
            seed: 1234,
            createSimWorker: fakeFactory,
        });
        // Build a snapshot-like state and call the worker's snapshot handler
        const state = makeInitialState();
        state.ships.push(createShip(undefined, 12, 34, "red"));
        state.bullets.push({
            id: 1,
            x: 100,
            y: 200,
            vx: 0,
            vy: 0,
            team: "red",
            damage: 1,
            ttl: 1,
        });
        // Simulate worker 'snapshot' event
        if (capturedWorker &&
            capturedWorker._handlers &&
            typeof capturedWorker._handlers["snapshot"] === "function") {
            capturedWorker._handlers["snapshot"]({ state });
        }
        // Rendering is coalesced to the next RAF; wait for it to occur.
        await new Promise((resolve) => {
            // In test environment requestAnimationFrame may be polyfilled by happy-dom
            // or vitest; this ensures we yield to the RAF.
            requestAnimationFrame(() => setTimeout(resolve, 0));
        });
        // The manager should have invoked renderer.renderState with an object that
        // contains the worker snapshot's ships and bullets. At least one call should
        // exist, and the latest call should include the arrays from the posted state.
        expect(calls.length).toBeGreaterThanOrEqual(1);
        const last = calls[calls.length - 1];
        expect(Array.isArray(last.ships)).toBeTruthy();
        expect(Array.isArray(last.bullets)).toBeTruthy();
        expect(last.ships.length).toBe(state.ships.length);
        expect(last.bullets.length).toBe(state.bullets.length);
    });
});
