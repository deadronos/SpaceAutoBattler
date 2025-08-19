import { describe, it, expect, beforeEach } from 'vitest';
import * as gm from '../src/gamemanager.js';
import { Ship, Team } from '../src/entities.js';
import { srand } from '../src/rng.js';

describe('GameManager strategy hooks', () => {
  beforeEach(() => { srand(1234); gm.reset(1234); });

  it('uses injected carrierLaunchStrategy when provided', () => {
  const carrier = new Ship(Team.RED, 300, 300, 'carrier');
  gm.reset(); // ensure clean
  // place carrier into gm.ships
  gm.ships.length = 0; gm.ships.push(carrier);
    // inject deterministic strategy that always spawns 2 fighters
    gm.setCarrierLaunchStrategy((c, ships, dt) => {
      const f1 = new Ship(c.team, c.x+10, c.y, 'fighter');
      const f2 = new Ship(c.team, c.x-10, c.y, 'fighter');
      f1.ownerCarrier = c.id; f2.ownerCarrier = c.id;
      c.launchCooldown = 5; // reset
      c.activeFighters.push(f1.id, f2.id);
      return [f1, f2];
    });
  gm.simulate(0.016, 800, 600);
  const fighters = gm.ships.filter(s => s.type === 'fighter' && s.ownerCarrier === carrier.id);
    expect(fighters.length).toBe(2);
  });
});
