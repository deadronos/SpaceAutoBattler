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
    // High mobility small weapon: slightly less accurate by default
    accuracy: 0.9,
    maxSpreadRadians: (2 * Math.PI) / 180, // ~2 degrees
  },

  // Corvette dual cannons
  'corvette-cannon': {
    id: 'corvette-cannon',
    cooldown: 0.7,
    bulletSpeed: 380,
    damage: 9,
    range: 340,
    accuracy: 0.92,
    maxSpreadRadians: (1.8 * Math.PI) / 180,
  },

  // Frigate triple cannons
  'frigate-cannon': {
    id: 'frigate-cannon',
    cooldown: 0.8,
    bulletSpeed: 360,
    damage: 14,
    range: 380,
    accuracy: 0.94,
    maxSpreadRadians: (1.5 * Math.PI) / 180,
  },

  // Destroyer quad cannons
  'destroyer-cannon': {
    id: 'destroyer-cannon',
    cooldown: 1.0,
    bulletSpeed: 340,
    damage: 24,
    range: 420,
    accuracy: 0.96,
    maxSpreadRadians: (1.2 * Math.PI) / 180,
  },

  // Carrier dual cannons
  'carrier-cannon': {
    id: 'carrier-cannon',
    cooldown: 1.2,
    bulletSpeed: 320,
    damage: 18,
    range: 420,
    accuracy: 0.95,
    maxSpreadRadians: (1.5 * Math.PI) / 180,
  },
};

// Ship class configurations
export const SHIP_CLASS_CONFIGS: Record<ShipClass, ShipClassConfig> = {
  fighter: {
    class: 'fighter',
    baseHealth: 80,
    armor: 2,
    shield: 50,
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
    shieldRegen: 10,
    speed: 110,
    turnRate: Math.PI * 0.7,
    turrets: [TURRET_CONFIGS['corvette-cannon'], TURRET_CONFIGS['corvette-cannon']],
  },

  frigate: {
    class: 'frigate',
    baseHealth: 420,
    armor: 8,
    shield: 260,
    shieldRegen: 13,
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
    shield: 600,
    shieldRegen: 60,
    speed: 65,
    turnRate: Math.PI * 0.35,
    turrets: [
      TURRET_CONFIGS['destroyer-cannon'],
      TURRET_CONFIGS['destroyer-cannon'],
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
    shield: 800,
    shieldRegen: 80,
    speed: 55,
    turnRate: Math.PI * 0.3,
    turrets: [
      TURRET_CONFIGS['carrier-cannon'],
      TURRET_CONFIGS['carrier-cannon'],
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
