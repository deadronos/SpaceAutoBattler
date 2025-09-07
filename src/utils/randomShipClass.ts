import type { GameState, ShipClass } from '../types/index.js';

const classes = ['fighter', 'corvette', 'frigate', 'destroyer', 'carrier'] as const;

export function randomClass(state: GameState): ShipClass {
  return classes[Math.floor(state.rng.next() * classes.length)];
}
