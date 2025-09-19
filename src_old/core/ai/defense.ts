import type { GameState, Ship } from '../../types/index.js';

export function updateShieldRegeneration(state: GameState, ship: Ship, dt: number) {
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
  const newShield = clamp(ship.shield + ship.shieldRegen * dt, 0, ship.maxShield);
  if (newShield !== ship.shield) {
    ship.shield = newShield;
    ship._shieldDirty = true;
  }
}
