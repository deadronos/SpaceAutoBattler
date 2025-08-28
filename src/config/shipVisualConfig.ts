// Ship visual configuration for rendering parameters
import type { ShipClass } from '../types/index.js';

export interface ShipVisualConfig {
  ships: Record<ShipClass, {
    scale: number; // Visual scale multiplier
    collisionRadius: number; // Collision detection radius
  }>;
  healthBar: {
    offset: {
      x: number;
      y: number;
      z: number;
    };
  };
  shield: {
    scaleMultipliers: Record<ShipClass, number>; // Scale multiplier for shield effects
  };
}

export const DefaultShipVisualConfig: ShipVisualConfig = {
  ships: {
    fighter: { scale: 0.7, collisionRadius: 16 },
    corvette: { scale: 0.9, collisionRadius: 16 },
    frigate: { scale: 1.1, collisionRadius: 20 },
    destroyer: { scale: 1.35, collisionRadius: 20 },
    carrier: { scale: 1.6, collisionRadius: 20 },
  },
  healthBar: {
    offset: {
      x: 0,
      y: -25,
      z: 10,
    },
  },
  shield: {
    scaleMultipliers: {
      fighter: 0.8,
      corvette: 1.0,
      frigate: 1.2,
      destroyer: 1.4,
      carrier: 1.6,
    },
  },
};

// Export the default config as ShipVisualConfig for backward compatibility
export const ShipVisualConfig = DefaultShipVisualConfig;