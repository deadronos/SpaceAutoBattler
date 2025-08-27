import { test, expect } from 'vitest';
import { createShip, makeInitialState } from '../../src/entities';
import { simulateStep } from '../../src/simulate';
import { SIM } from '../../src/config/simConfig';
test('ship with throttle and accel gains non-zero velocity after one step', () => {
    const state = makeInitialState();
    // place ship near center
    const ship = createShip('fighter', 960, 540, 'blue');
    // ensure the ship has accel from config
    ship.accel = ship.accel || 5;
    ship.throttle = 1; // full throttle
    ship.steering = 0;
    ship.vx = 0;
    ship.vy = 0;
    state.ships.push(ship);
    const bounds = { W: 1920, H: 1080 };
    // run one simulation step using canonical SIM.DT_MS
    const dtSeconds = (SIM && SIM.DT_MS ? SIM.DT_MS / 1000 : 0.016);
    simulateStep(state, dtSeconds, bounds);
    // After one step, either vx or vy should be non-zero if accel/throttle > 0
    const vx = ship.vx || 0;
    const vy = ship.vy || 0;
    const speedSq = vx * vx + vy * vy;
    expect(speedSq).toBeGreaterThan(0);
});
