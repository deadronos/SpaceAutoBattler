import { describe, it, expect } from 'vitest';
import { chooseReinforcements } from '../../src/config/teamsConfig';

describe('teamsConfig helpers', () => {
  it('chooseReinforcements is deterministic for a seed and state', () => {
    const seed = 12345;
    const state = { ships: [ { id: 1, team: 'red', hp: 10 }, { id: 2, team: 'blue', hp: 20 } ] };
    const orders1 = chooseReinforcements(seed, state, { perTick: 2 });
    const orders2 = chooseReinforcements(seed, state, { perTick: 2 });
    expect(orders1).toEqual(orders2);
  });
});
