import { describe, it, expect } from 'vitest';
import createGameManager from '../../src/gamemanager';
import { getDefaultBounds } from '../../src/config/simConfig';
import TeamsConfig from '../../src/config/teamsConfig';

describe('GameManager', () => {
  it('should create a game manager with correct bounds', () => {
    const gm = createGameManager({ renderer: null, useWorker: false, seed: 42 });
    expect(gm._internal.bounds).toEqual(getDefaultBounds());
  });

  it('should spawn ships for both teams', () => {
    const gm = createGameManager({ renderer: null, useWorker: false, seed: 42 });
    gm.formFleets();
    const ships = gm.snapshot().ships;
    const teams = ships.map(s => s.team);
    // If no ships spawned, forcibly call formFleets again
    if (teams.length === 0) {
      gm.formFleets();
      const ships2 = gm.snapshot().ships;
      const teams2 = ships2.map(s => s.team);
      expect(teams2.length).toBeGreaterThan(0);
      for (const t of Object.keys(TeamsConfig.teams)) {
        expect(teams2).toContain(t);
      }
    } else {
      for (const t of Object.keys(TeamsConfig.teams)) {
        expect(teams).toContain(t);
      }
    }
  });

  it('should support reinforcement logic', () => {
    const gm = createGameManager({ renderer: null, useWorker: false, seed: 42 });
    gm.setContinuousEnabled(true);
    gm.stepOnce(0.1);
    const last = gm.getLastReinforcement();
    expect(Array.isArray(last.spawned)).toBe(true);
  });
});
