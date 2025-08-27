import { describe, it, expect } from 'vitest';
import createGameManager from '../../src/gamemanager';
import { SIM, boundaryBehavior } from '../../src/config/simConfig';
describe('shipMap sync', () => {
    it('keeps shipMap in sync after spawn and removal', () => {
        const gm = createGameManager({ renderer: null, useWorker: false, seed: 12345 });
        const state = gm._internal.state;
        // Spawn a ship and verify shipMap contains it
        const ship = gm.spawnShip('red');
        expect(ship).toBeTruthy();
        if (!ship)
            return; // defensive - satisfy types
        expect(state.shipMap).toBeDefined();
        expect(state.shipMap.has(ship.id)).toBe(true);
        // Force the ship out of bounds so simulate step removes it
        const prev = boundaryBehavior.ships;
        try {
            boundaryBehavior.ships = 'remove';
            ship.x = -99999;
            ship.y = -99999;
            // run a single step (small dt)
            gm.stepOnce(SIM.DT_MS / 1000);
        }
        finally {
            boundaryBehavior.ships = prev;
        }
        // After step, the ship should be removed from ships[] and shipMap
        const found = (state.ships || []).find((s) => s && s.id === ship.id);
        expect(found).toBeUndefined();
        expect(state.shipMap.has(ship.id)).toBe(false);
    });
});
