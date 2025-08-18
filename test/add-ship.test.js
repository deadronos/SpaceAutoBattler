import { describe, it, expect, beforeEach } from 'vitest';
import { initRendererUI, ships, randomShipType, createShipFromUI } from '../src/renderer.js';
import { Ship, Team } from '../src/entities.js';
import { srand, srange, assertSeeded } from '../src/rng.js';

describe('Add ship UI and deterministic ship type selection', () => {
  beforeEach(() => {
    // reset DOM and ships array
    document.body.innerHTML = '';
    ships.length = 0;
  });

  it('clicking +Red adds a ship of a valid type', () => {
    const btn = document.createElement('button');
    btn.id = 'addRed';
    document.body.appendChild(btn);

    // wire UI
    expect(() => initRendererUI()).not.toThrow();

    // click to add
    btn.click();
    expect(ships.length).toBeGreaterThanOrEqual(1);
    const allowed = ['corvette','frigate','destroyer','carrier','fighter'];
    expect(allowed).toContain(ships[ships.length - 1].type);
  });

  it('randomShipType sequence is deterministic when seeded', () => {
    srand(12345);
    const seq1 = [];
    for (let i = 0; i < 8; i++) seq1.push(randomShipType());

    srand(12345);
    const seq2 = [];
    for (let i = 0; i < 8; i++) seq2.push(randomShipType());

    expect(seq1).toEqual(seq2);
  });

  it('clicking +Blue adds a ship of a valid type', () => {
    const btn = document.createElement('button');
    btn.id = 'addBlue';
    document.body.appendChild(btn);

    expect(() => initRendererUI()).not.toThrow();

    btn.click();
    expect(ships.length).toBeGreaterThanOrEqual(1);
    const allowed = ['corvette','frigate','destroyer','carrier','fighter'];
    expect(allowed).toContain(ships[ships.length - 1].type);
  });

  it('UI deterministic integration: seeded srand produces exact spawn sequence when clicking add buttons', () => {
    // We'll simulate the exact operations performed by the UI click handlers
    // per click: randomShipType() (srangeInt) then srange(40, W*0.35) then srange(80, H-80)
    const seed = 12345;
    const clicksCount = 8;
    const expected = [];

    // seed and compute expected sequence by consuming RNG in the same order the UI would
    srand(seed);
    for (let i = 0; i < clicksCount; i++) {
      expected.push(randomShipType());
      const W = window.innerWidth || 800;
      const H = window.innerHeight || 600;
      // consume the position RNG calls
      // eslint-disable-next-line no-unused-vars
      const _x = srange(40, W * 0.35);
      // eslint-disable-next-line no-unused-vars
      const _y = srange(80, H - 80);
  // The Ship constructor now only consumes RNG for the chosen type's
  // numeric fields (previously it evaluated all types at once). For the
  // current implementation this is 3 srange calls for most types, and 6
  // total for 'carrier' (4 in config + 2 extra in constructor). Consume
  // the same number of RNG values here so the expected sequence matches
  // the real UI flow.
  const callsForType = (t) => (t === 'carrier' ? 6 : 3);
  for (let k = 0; k < callsForType(expected[i]); k++) srange(0, 1);
    }

    // now reseed and perform the same actions that the add buttons perform using
    // the exported test helper so the test stays clearer and robust to internal
    // constructor details.
    srand(seed);
    ships.length = 0;
    const teamSeq = [Team.RED, Team.BLUE, Team.RED, Team.RED, Team.BLUE, Team.RED, Team.BLUE, Team.BLUE];
    for (const tm of teamSeq) {
      createShipFromUI(tm);
    }

    expect(ships.length).toBeGreaterThanOrEqual(expected.length);
    const actual = ships.slice(0, expected.length).map(s => s.type);
    expect(actual).toEqual(expected);
  });
});
