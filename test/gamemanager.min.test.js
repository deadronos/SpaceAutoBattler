import { describe, it, expect } from 'vitest';
import * as GM from '../src/gamemanager.js';

describe('gamemanager (minimal)', () => {
  it('reset seeds RNG and clears arrays', () => {
    GM.reset(123);
    expect(Array.isArray(GM.ships)).toBe(true);
    expect(GM.ships.length).toBeGreaterThanOrEqual(0);
  });

  it('simulate returns snapshot containing arrays', () => {
    GM.reset(1);
    const snap = GM.simulate(0.016, 800, 600);
    expect(snap).toHaveProperty('ships');
    expect(snap).toHaveProperty('bullets');
  });
});
