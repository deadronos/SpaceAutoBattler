import { describe, it, expect } from 'vitest';
import { makeInitialState, createShip, updateTeamCount } from '../../src/entities';

describe('team switching', () => {
  it('updates teamCounts when a ship changes teams via updateTeamCount', () => {
    const state = makeInitialState();
    // create a ship on red team and add to state
    const ship = createShip(undefined, 0, 0, 'red');
    state.ships.push(ship as any);
    // increment red count
    updateTeamCount(state, undefined, 'red');
    expect(state.teamCounts.red).toBe(1);
    expect(state.teamCounts.blue).toBe(0);

    // switch team to blue
    const oldTeam = ship.team as string;
    ship.team = 'blue';
    updateTeamCount(state, oldTeam, 'blue');
    expect(state.teamCounts.red).toBe(0);
    expect(state.teamCounts.blue).toBe(1);

    // switching back to red
    const oldTeam2 = ship.team as string;
    ship.team = 'red';
    updateTeamCount(state, oldTeam2, 'red');
    expect(state.teamCounts.red).toBe(1);
    expect(state.teamCounts.blue).toBe(0);
  });
});
