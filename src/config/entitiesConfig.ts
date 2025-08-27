import type { ShipClass, ShipClassConfig, TurretConfig } from '../types/index.js';

// Turret configurations - shared across ship classes
export const TURRET_CONFIGS: Record<string, TurretConfig> = {
  // Basic cannon for fighters
  'fighter-cannon': {
    id: 'fighter-cannon',
    cooldown: 0.6,
    bulletSpeed: 400,
    damage: 6,
    range: 300,
  },

  // Corvette dual cannons
  'corvette-cannon': {
    id: 'corvette-cannon',
    cooldown: 0.7,
    bulletSpeed: 380,
    damage: 9,
    range: 340,
  },

  // Frigate triple cannons
  'frigate-cannon': {
    id: 'frigate-cannon',
    cooldown: 0.8,
    bulletSpeed: 360,
    damage: 14,
    range: 380,
  },

  // Destroyer quad cannons
  'destroyer-cannon': {
    id: 'destroyer-cannon',
    cooldown: 1.0,
    bulletSpeed: 340,
    damage: 24,
    range: 420,
  },

  // Carrier dual cannons
  'carrier-cannon': {
    id: 'carrier-cannon',
    cooldown: 1.2,
    bulletSpeed: 320,
    damage: 18,
    range: 420,
  },
};

// Ship class configurations
export const SHIP_CLASS_CONFIGS: Record<ShipClass, ShipClassConfig> = {
  fighter: {
    class: 'fighter',
    baseHealth: 80,
    armor: 2,
    shield: 40,
    shieldRegen: 5,
    speed: 140,
    turnRate: Math.PI,
    turrets: [TURRET_CONFIGS['fighter-cannon']],
  },

  corvette: {
    class: 'corvette',
    baseHealth: 180,
    armor: 4,
    shield: 120,
    shieldRegen: 8,
    speed: 110,
    turnRate: Math.PI * 0.7,
    turrets: [
      TURRET_CONFIGS['corvette-cannon'],
      TURRET_CONFIGS['corvette-cannon'],
    ],
  },

  frigate: {
    class: 'frigate',
    baseHealth: 420,
    armor: 8,
    shield: 260,
    shieldRegen: 10,
    speed: 85,
    turnRate: Math.PI * 0.5,
    turrets: [
      TURRET_CONFIGS['frigate-cannon'],
      TURRET_CONFIGS['frigate-cannon'],
      TURRET_CONFIGS['frigate-cannon'],
    ],
  },

  destroyer: {
    class: 'destroyer',
    baseHealth: 800,
    armor: 12,
    shield: 480,
    shieldRegen: 12,
    speed: 65,
    turnRate: Math.PI * 0.35,
    turrets: [
      TURRET_CONFIGS['destroyer-cannon'],
      TURRET_CONFIGS['destroyer-cannon'],
      TURRET_CONFIGS['destroyer-cannon'],
      TURRET_CONFIGS['destroyer-cannon'],
    ],
  },

  carrier: {
    class: 'carrier',
    baseHealth: 1000,
    armor: 10,
    shield: 600,
    shieldRegen: 14,
    speed: 55,
    turnRate: Math.PI * 0.3,
    turrets: [
      TURRET_CONFIGS['carrier-cannon'],
      TURRET_CONFIGS['carrier-cannon'],
    ],
    maxFighters: 6,
    fighterSpawnCooldown: 6,
  },
};

// Helper functions for accessing configurations
export function getShipClassConfig(shipClass: ShipClass): ShipClassConfig {
  return SHIP_CLASS_CONFIGS[shipClass];
}

export function getTurretConfig(turretId: string): TurretConfig | undefined {
  return TURRET_CONFIGS[turretId];
}

export function getAllShipClasses(): ShipClass[] {
  return Object.keys(SHIP_CLASS_CONFIGS) as ShipClass[];
}

export function getAllTurretConfigs(): TurretConfig[] {
  return Object.values(TURRET_CONFIGS);
}