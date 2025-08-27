import { describe, it, expect } from 'vitest';
import { simulateStep } from '../../src/simulate';
import { LOGICAL_MAP, boundaryBehavior } from '../../src/config/simConfig';
import { createShip, makeInitialState } from '../../src/entities';
function makeShip(x, y, vx = 0, vy = 0) {
    const ship = createShip(undefined, x, y, 'red');
    ship.vx = vx;
    ship.vy = vy;
    return ship;
}
describe('Logical map boundary behavior', () => {
    it('wrap: ship wraps at smaller map', () => {
        LOGICAL_MAP.W = 400;
        LOGICAL_MAP.H = 300;
        boundaryBehavior.ships = 'wrap';
        const bounds = { W: LOGICAL_MAP.W, H: LOGICAL_MAP.H };
        const state = makeInitialState();
        state.t = 0;
        state.ships = [makeShip(399, 299, 5, 5)];
        state.bullets = [];
        state.shieldHits = [];
        state.healthHits = [];
        state.explosions = [];
        state.damageEvents = [];
        simulateStep(state, 0.1, bounds);
        // Ship should wrap to opposite edge
        expect(state.ships.length).toBeGreaterThan(0);
        const ship = state.ships[0];
        expect(ship).toBeDefined();
        expect(ship.radius).toBeDefined();
        expect(ship.x).toBeLessThanOrEqual(bounds.W + (ship.radius ?? 0));
        expect(ship.y).toBeLessThanOrEqual(bounds.H + (ship.radius ?? 0));
    });
    it('remove: ship is removed at smaller map', () => {
        LOGICAL_MAP.W = 400;
        LOGICAL_MAP.H = 300;
        boundaryBehavior.ships = 'remove';
        const bounds = { W: LOGICAL_MAP.W, H: LOGICAL_MAP.H };
        const state = makeInitialState();
        state.t = 0;
        state.ships = [makeShip(400 + 12 + 1, 300 + 12 + 1, 5, 5)];
        state.bullets = [];
        state.shieldHits = [];
        state.healthHits = [];
        state.explosions = [];
        state.damageEvents = [];
        simulateStep(state, 0.1, bounds);
        // Ship should be removed
        // Debug output
        // eslint-disable-next-line no-console
        console.log('remove: smaller map', state.ships);
        expect(state.ships.length).toBe(0);
    });
    it('bounce: ship bounces at smaller map', () => {
        LOGICAL_MAP.W = 400;
        LOGICAL_MAP.H = 300;
        boundaryBehavior.ships = 'bounce';
        const bounds = { W: LOGICAL_MAP.W, H: LOGICAL_MAP.H };
        const state = makeInitialState();
        state.t = 0;
        state.ships = [makeShip(400 + 12 + 1, 300 + 12 + 1, 5, 5)];
        state.bullets = [];
        state.shieldHits = [];
        state.healthHits = [];
        state.explosions = [];
        state.damageEvents = [];
        simulateStep(state, 0.1, bounds);
        // Ship should bounce and remain in bounds
        expect(state.ships.length).toBeGreaterThan(0);
        const ship = state.ships[0];
        expect(ship).toBeDefined();
        expect(ship.radius).toBeDefined();
        // Debug output
        // eslint-disable-next-line no-console
        console.log('bounce: smaller map', ship);
        expect(ship.x).toBeLessThanOrEqual(bounds.W + (ship.radius ?? 0));
        expect(ship.y).toBeLessThanOrEqual(bounds.H + (ship.radius ?? 0));
        expect(ship.vx).toBeLessThanOrEqual(0); // velocity reversed
        expect(ship.vy).toBeLessThanOrEqual(0);
    });
    it('wrap: ship wraps at larger map', () => {
        LOGICAL_MAP.W = 3000;
        LOGICAL_MAP.H = 2000;
        boundaryBehavior.ships = 'wrap';
        const bounds = { W: LOGICAL_MAP.W, H: LOGICAL_MAP.H };
        const state = makeInitialState();
        state.t = 0;
        state.ships = [makeShip(2999, 1999, 10, 10)];
        state.bullets = [];
        state.shieldHits = [];
        state.healthHits = [];
        state.explosions = [];
        state.damageEvents = [];
        simulateStep(state, 0.1, bounds);
        expect(state.ships.length).toBeGreaterThan(0);
        const ship = state.ships[0];
        expect(ship).toBeDefined();
        expect(ship.radius).toBeDefined();
        expect(ship.x).toBeLessThanOrEqual(bounds.W + (ship.radius ?? 0));
        expect(ship.y).toBeLessThanOrEqual(bounds.H + (ship.radius ?? 0));
    });
    it('remove: ship is removed at larger map', () => {
        LOGICAL_MAP.W = 3000;
        LOGICAL_MAP.H = 2000;
        boundaryBehavior.ships = 'remove';
        const bounds = { W: LOGICAL_MAP.W, H: LOGICAL_MAP.H };
        const state = makeInitialState();
        state.t = 0;
        state.ships = [makeShip(3000 + 12 + 1, 2000 + 12 + 1, 10, 10)];
        state.bullets = [];
        state.shieldHits = [];
        state.healthHits = [];
        state.explosions = [];
        state.damageEvents = [];
        simulateStep(state, 0.1, bounds);
        // Debug output
        // eslint-disable-next-line no-console
        console.log('remove: larger map', state.ships);
        expect(state.ships.length).toBe(0);
    });
    it('bounce: ship bounces at larger map', () => {
        LOGICAL_MAP.W = 3000;
        LOGICAL_MAP.H = 2000;
        boundaryBehavior.ships = 'bounce';
        const bounds = { W: LOGICAL_MAP.W, H: LOGICAL_MAP.H };
        const state = makeInitialState();
        state.t = 0;
        state.ships = [makeShip(3000 + 12 + 1, 2000 + 12 + 1, 10, 10)];
        state.bullets = [];
        state.shieldHits = [];
        state.healthHits = [];
        state.explosions = [];
        state.damageEvents = [];
        simulateStep(state, 0.1, bounds);
        expect(state.ships.length).toBeGreaterThan(0);
        const ship = state.ships[0];
        expect(ship).toBeDefined();
        expect(ship.radius).toBeDefined();
        // Debug output
        // eslint-disable-next-line no-console
        console.log('bounce: larger map', ship);
        expect(ship.x).toBeLessThanOrEqual(bounds.W + (ship.radius ?? 0));
        expect(ship.y).toBeLessThanOrEqual(bounds.H + (ship.radius ?? 0));
        expect(ship.vx).toBeLessThanOrEqual(0);
        expect(ship.vy).toBeLessThanOrEqual(0);
    });
});
