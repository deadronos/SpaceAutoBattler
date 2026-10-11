import type { ShipHull, Team } from '../types/index.js';

/**
 * Coerces an unknown team value to a valid `Team` (defaults to 'blue').
 *
 * @param {unknown} value - Raw team value.
 * @returns {Team}
 */
export function coerceTeam(value: unknown): Team {
  return value === 'red' ? 'red' : 'blue';
}

/**
 * Coerces an unknown hull value to a valid `ShipHull` (defaults to 'fighter').
 *
 * @param {unknown} value - Raw hull value.
 * @returns {ShipHull}
 */
export function coerceHull(value: unknown): ShipHull {
  switch (value) {
    case 'fighter':
    case 'corvette':
    case 'frigate':
    case 'destroyer':
    case 'carrier':
      return value;
    default:
      return 'fighter';
  }
}
