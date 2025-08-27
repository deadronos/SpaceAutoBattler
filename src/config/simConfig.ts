import type { Config, ShipClassConfig } from '../types/index.js';

const classes: Record<ShipClassConfig['class'], ShipClassConfig> = {
  fighter: {
    class: 'fighter', baseHealth: 80, armor: 2, shield: 40, shieldRegen: 5,
    speed: 140, turnRate: Math.PI, turrets: [
      { id: 'cannon', cooldown: 0.6, bulletSpeed: 400, damage: 6, range: 300 },
    ],
  },
  corvette: {
    class: 'corvette', baseHealth: 180, armor: 4, shield: 120, shieldRegen: 8,
    speed: 110, turnRate: Math.PI * 0.7, turrets: [
      { id: 'cannon', cooldown: 0.7, bulletSpeed: 380, damage: 9, range: 340 },
      { id: 'cannon', cooldown: 0.7, bulletSpeed: 380, damage: 9, range: 340 },
    ],
  },
  frigate: {
    class: 'frigate', baseHealth: 420, armor: 8, shield: 260, shieldRegen: 10,
    speed: 85, turnRate: Math.PI * 0.5, turrets: [
      { id: 'cannon', cooldown: 0.8, bulletSpeed: 360, damage: 14, range: 380 },
      { id: 'cannon', cooldown: 0.8, bulletSpeed: 360, damage: 14, range: 380 },
      { id: 'cannon', cooldown: 0.8, bulletSpeed: 360, damage: 14, range: 380 },
    ],
  },
  destroyer: {
    class: 'destroyer', baseHealth: 800, armor: 12, shield: 480, shieldRegen: 12,
    speed: 65, turnRate: Math.PI * 0.35, turrets: [
      { id: 'cannon', cooldown: 1.0, bulletSpeed: 340, damage: 24, range: 420 },
      { id: 'cannon', cooldown: 1.0, bulletSpeed: 340, damage: 24, range: 420 },
      { id: 'cannon', cooldown: 1.0, bulletSpeed: 340, damage: 24, range: 420 },
      { id: 'cannon', cooldown: 1.0, bulletSpeed: 340, damage: 24, range: 420 },
    ],
  },
  carrier: {
    class: 'carrier', baseHealth: 1000, armor: 10, shield: 600, shieldRegen: 14,
    speed: 55, turnRate: Math.PI * 0.3, turrets: [
      { id: 'cannon', cooldown: 1.2, bulletSpeed: 320, damage: 18, range: 420 },
      { id: 'cannon', cooldown: 1.2, bulletSpeed: 320, damage: 18, range: 420 },
    ],
    maxFighters: 6, fighterSpawnCooldown: 6,
  },
};

export const DefaultConfig: Config = {
  simBounds: { width: 2400, height: 1600 },
  classes,
  tickRate: 60,
  maxEntities: 5000,
};
