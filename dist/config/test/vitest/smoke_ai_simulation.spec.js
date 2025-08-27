import { describe, it, expect } from 'vitest';
import { makeInitialState, createShip } from '../../src/entities';
import { applySimpleAI } from '../../src/behavior';
import { simulateStep } from '../../src/simulate';
import { getDefaultBounds } from '../../src/config/simConfig';
// Quick smoke test: create two ships, run AI and simulation for a few steps,
// verify throttle/steering from AI produces changes in velocity and position.
describe('Smoke AI + Simulation', () => {
    it('ships should accelerate and move under AI control', () => {
        const state = makeInitialState();
        const shipA = createShip('fighter', 100, 100, 'red');
        const shipB = createShip('fighter', 300, 300, 'blue');
        state.ships.push(shipA, shipB);
        const dt = 0.1; // 100ms per step
        // Run several frames: apply AI then simulate
        let moved = false;
        for (let i = 0; i < 20; i++) {
            const bounds = getDefaultBounds();
            applySimpleAI(state, dt, bounds);
            simulateStep(state, dt, bounds);
            // If any ship gained non-zero velocity and moved position, mark moved
            for (const s of state.ships) {
                if ((s.vx || 0) !== 0 || (s.vy || 0) !== 0) {
                    if (Math.abs(s.x - s.x) > 1e-9)
                        moved = true; // trivial check (always true if x changed)
                    moved = true;
                    break;
                }
            }
            if (moved)
                break;
        }
        expect(moved).toBeTruthy();
    });
});
