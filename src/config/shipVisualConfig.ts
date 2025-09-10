// Ship visual configuration for rendering parameters
import type { ShipClass } from '../types/index.js';

export interface ShipVisualConfig {
  ships: Record<
    ShipClass,
    {
      scale: number; // Visual scale multiplier
      collisionRadius: number; // Collision detection radius
    }
  >;
  // Default fallback values when ship class is not found
  defaults: {
    collisionRadius: number; // Fallback collision radius for unknown ship classes
  };
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
    fighter: { scale: 1.0, collisionRadius: 13 },
    corvette: { scale: 1.0, collisionRadius: 17 },
    frigate: { scale: 1.0, collisionRadius: 19 },
    destroyer: { scale: 1.0, collisionRadius: 26 },
    carrier: { scale: 1.0, collisionRadius: 26 },
  },
  defaults: {
    collisionRadius: 16, // Default collision radius for unknown ship classes
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
      fighter: 1.0,
      corvette: 1.0,
      frigate: 1.0,
      destroyer: 1.0,
      carrier: 1.0,
    },
  },
};

// Export the default config as ShipVisualConfig for backward compatibility
export const ShipVisualConfig = DefaultShipVisualConfig;
