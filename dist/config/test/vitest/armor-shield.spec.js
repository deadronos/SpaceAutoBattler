import { describe, it, expect } from 'vitest';
import { makeInitialState, createShip, createBullet } from '../../src/entities';
import simulate from '../../src/simulate';
import { getDefaultBounds } from '../../src/config/simConfig';
// Helper to place bullet directly on ship to force immediate collision
function hitShipWithBullet(state, shipId, damage) {
    const ship = (state.ships || []).find(s => s.id === shipId);
    if (!ship)
        throw new Error('ship not found');
    // Fire from the opposing team so collision logic doesn't ignore same-team bullets
    const bulletTeam = (ship.team === 'red') ? 'blue' : 'red';
    const b = createBullet(ship.x, ship.y, 0, 0, bulletTeam, null, damage, 1.0);
    (state.bullets ||= []).push(b);
}
describe('Armor and Shields', () => {
    it('applies shield then armor to reduce hull damage', () => {
        const state = makeInitialState();
        // Create a frigate (armor:1, maxHp:80, maxShield ~= 48 per config)
        const ship = createShip('frigate', 100, 100, 'blue');
        (state.ships ||= []).push(ship);
        (state.shipMap ||= new Map()).set(ship.id, ship);
        // Ensure initial shield/hp values from config
        expect(ship.maxShield).toBeGreaterThan(0);
        const initialHp = ship.hp;
        const initialShield = ship.shield || 0;
        // Fire a bullet that deals damage greater than shield to overflow to hull
        const incoming = (initialShield || 0) + 10; // ensure some goes to hull
        hitShipWithBullet(state, ship.id, incoming);
        // Run simulation step small dt so collision processed
        simulate.simulateStep(state, 0.016, getDefaultBounds());
        // After step, shields should be reduced to 0 and some hull damage applied
        expect(ship.shield).toBeLessThan(initialShield);
        expect(ship.hp).toBeLessThan(initialHp);
        // Compute expected hull damage after armor: armor=1 -> 10% reduction
        const absorbed = Math.min(initialShield, incoming);
        const remaining = Math.max(0, incoming - absorbed);
        const expectedHullLoss = remaining * (1 - 0.1 * (ship.armor || 0));
        const actualHullLoss = initialHp - (ship.hp || 0);
        // Allow small floating epsilon
        expect(Math.abs(actualHullLoss - expectedHullLoss)).toBeLessThan(1e-6);
    });
    it('applies armor when no shields present', () => {
        const state = makeInitialState();
        const ship = createShip('fighter', 200, 200, 'red');
        (state.ships ||= []).push(ship);
        (state.shipMap ||= new Map()).set(ship.id, ship);
        // ensure fighter has armor 0 per config
        expect(ship.armor).toBeDefined();
        // remove shields for this test
        ship.shield = 0;
        ship.maxShield = 0;
        const initialHp = ship.hp;
        const dmg = 10;
        hitShipWithBullet(state, ship.id, dmg);
        simulate.simulateStep(state, 0.016, getDefaultBounds());
        const armor = ship.armor || 0;
        const expected = initialHp - dmg * Math.max(0, 1 - 0.1 * armor);
        expect(Math.abs((ship.hp || 0) - expected)).toBeLessThan(1e-6);
    });
});
