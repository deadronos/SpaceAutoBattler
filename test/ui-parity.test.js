import { describe, it, expect, beforeEach } from 'vitest';
import { createShipFromUI, chooseShipTypeAndCfg, ships } from '../src/renderer.js';
import { Team } from '../src/entities.js';
import { srand, srange } from '../src/rng.js';

describe('UI parity: createShipFromUI vs chooseShipTypeAndCfg', () => {
  beforeEach(() => {
    // reset state
    ships.length = 0;
    document.body.innerHTML = '';
    // provide reasonable window size for position calculations
    if (typeof window !== 'undefined') {
      window.innerWidth = 800;
      window.innerHeight = 600;
    }
  });

  it('types produced by createShipFromUI match chooseShipTypeAndCfg when reseeded', () => {
    const seed = 123456;
    const N = 8;

    // First: seed and call createShipFromUI N times, capture the produced ship types
    srand(seed);
    ships.length = 0;
    const typesFromUI = [];
    for (let i = 0; i < N; i++) {
      createShipFromUI(Team.RED);
      // ensure a ship was pushed
      expect(ships.length).toBeGreaterThan(i);
      typesFromUI.push(ships[i].type);
    }

    // Now reseed and call chooseShipTypeAndCfg N times to capture the raw types
    srand(seed);
    const typesFromChoose = [];
    for (let i = 0; i < N; i++) {
      const { type } = chooseShipTypeAndCfg();
      // consume the two position RNG draws that createShipFromUI performs
      srange(0, 1);
      srange(0, 1);
      typesFromChoose.push(type);
    }

    expect(typesFromUI).toEqual(typesFromChoose);
  });
});
