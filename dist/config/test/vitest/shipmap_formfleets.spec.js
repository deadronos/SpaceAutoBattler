import { describe, it, expect } from 'vitest';
import createGameManager from '../../src/gamemanager';
describe('shipMap population', () => {
    it('populates shipMap when formFleets is called', () => {
        const gm = createGameManager({ renderer: null, useWorker: false, seed: 42 });
        const state = gm._internal.state;
        // Ensure empty at start
        expect(Array.isArray(state.ships)).toBe(true);
        // Call formFleets which should populate state.ships and state.shipMap
        gm.formFleets();
        expect((state.ships || []).length).toBeGreaterThan(0);
        expect(state.shipMap).toBeDefined();
        for (const s of (state.ships || [])) {
            expect(state.shipMap.has(s.id)).toBe(true);
            expect(state.shipMap.get(s.id)).toBe(s);
        }
    });
});
