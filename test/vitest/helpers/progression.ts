import { createProgressionDefaults, createSubsystems } from '../../../src/game/progression.js';
import type { ShipComponent, ShipHull } from '../../../src/types/index.js';

export interface ProgressionOptions {
  hull?: ShipHull;
  maxHpOverride?: number;
}

export function applyProgressionDefaults<T extends ShipComponent>(ship: T, options: ProgressionOptions = {}): T {
  const hull = (options.hull ?? ship.hull ?? 'fighter') as ShipHull;
  const defaults = createProgressionDefaults(hull);
  const maxHp = options.maxHpOverride ?? ship.maxHp ?? 100;

  ship.xp = defaults.xp;
  ship.level = defaults.level;
  ship.xpToNext = defaults.xpToNext;
  ship.damageType = ship.damageType ?? defaults.damageType;
  ship.captain = ship.captain ?? defaults.captain;
  ship.subsystems = createSubsystems(maxHp);
  ship.armor = ship.armor ?? defaults.armor;

  return ship;
}
