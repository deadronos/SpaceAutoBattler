// Physics properties and collider configuration
import type { ShipClass } from '../types/index.js';

export interface PhysicsConfig {
  damping: {
    linear: number; // Linear damping factor
    angular: number; // Angular damping factor
  };
  acceleration: {
    forwardMultiplier: number; // Forward acceleration multiplier
    zAxisMultiplier: number; // Z-axis movement multiplier
  };
  colliders: Record<ShipClass, {
    width: number;
    height: number;
    depth: number;
  }>;
  properties: {
    density: number;
    friction: number;
    restitution: number;
  };
  speed: {
    dampingFactor: number; // Speed damping factor (0.98)
    maxSpeedMultiplier: number; // Maximum speed multiplier for clamping
  };
}

export const DefaultPhysicsConfig: PhysicsConfig = {
  damping: {
    linear: 0.1,
    angular: 0.5,
  },
  acceleration: {
    forwardMultiplier: 0.5,
    zAxisMultiplier: 0.1,
  },
  colliders: {
    fighter: { width: 4, height: 1.5, depth: 4 },
    corvette: { width: 6, height: 2, depth: 6 },
    frigate: { width: 8, height: 2.5, depth: 8 },
    destroyer: { width: 10, height: 3, depth: 10 },
    carrier: { width: 12, height: 3.5, depth: 12 },
  },
  properties: {
    density: 1.0,
    friction: 0.3,
    restitution: 0.1,
  },
  speed: {
    dampingFactor: 0.98,
    maxSpeedMultiplier: 1.0, // Multiplier for ship's base speed
  },
};

// Export the default config as PhysicsConfig for backward compatibility
export const PhysicsConfig = DefaultPhysicsConfig;