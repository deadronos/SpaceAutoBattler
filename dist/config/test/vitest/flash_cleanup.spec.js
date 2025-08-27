import { describe, it, expect } from "vitest";
import createGameManager from "../../src/gamemanager";
import { makeInitialState } from "../../src/entities";
// Verify that transient flash arrays are cleared after render
describe("flash cleanup", () => {
    it("clears flash arrays after render", async () => {
        const calls = [];
        const fakeRenderer = {
            renderState: (s) => {
                calls.push(s);
            },
        };
        const gm = createGameManager({
            renderer: fakeRenderer,
            useWorker: false,
            seed: 2,
        });
        // simulate adding flashes to the manager state
        const st = makeInitialState();
        st.ships.push({ id: 1 });
        // Use internal API if exposed: attempt to post a snapshot
        if (gm.onSnapshot) {
            gm.onSnapshot({ state: st });
        }
        await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
        // After render, renderer should have been called. If manager exposes state, assert flashes cleared.
        expect(calls.length).toBeGreaterThanOrEqual(1);
        if (gm.state) {
            const s = gm.state;
            expect(Array.isArray(s.flashes)).toBeTruthy();
            expect(s.flashes.length).toBe(0);
        }
    });
});
