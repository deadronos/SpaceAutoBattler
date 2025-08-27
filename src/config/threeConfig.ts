// 3D Configuration Settings
// This file contains all 3D-specific configuration for the SpaceAutoBattler simulation

import { Bounds3D } from './simConfig.js';

// 3D Boundary Configuration
export const BOUNDS_3D: Bounds3D = {
  width: 1920,
  height: 1080,
  depth: 1920,
  wrap: { 
    x: true,     // Horizontal wrap-around
    y: false,    // No vertical wrap (sky/ground boundaries)
    z: true      // Depth wrap-around
  }
};

// Ship Scaling Configuration
// All ships use normalized 1x1x1 base geometries with configurable scaling
export const SHIP_SCALE_CONFIG = {
  // Base scaling factors for different ship classes
  SMALL_SHIP_SCALE: 0.8,    // Fighters, Corvettes
  MEDIUM_SHIP_SCALE: 1.2,   // Frigates
  LARGE_SHIP_SCALE: 1.6,    // Destroyers, Carriers
  
  // Collision radius multipliers (relative to base scale)
  COLLISION_RADIUS_MULTIPLIER: 0.6,
  
  // Component positioning scale (how much components scale with ship)
  COMPONENT_SCALE_MULTIPLIER: 1.0
};

// Ship Type Configurations
export interface ShipTypeConfig {
  scale: number;
  collisionRadius: number;
  turrets: Array<{ x: number; y: number; z: number }>;
  engines: Array<{ x: number; y: number; z: number }>;
  hardpoints: Array<{ x: number; y: number; z: number }>;
}

// Specific configurations for each ship type
export const SHIP_TYPE_CONFIGS = {
  fighter: {
    scale: SHIP_SCALE_CONFIG.SMALL_SHIP_SCALE,
    collisionRadius: SHIP_SCALE_CONFIG.SMALL_SHIP_SCALE * SHIP_SCALE_CONFIG.COLLISION_RADIUS_MULTIPLIER,
    turrets: [
      { x: 0.3, y: 0.1, z: 0.2 },   // Front turret
      { x: -0.3, y: 0.1, z: -0.2 }  // Rear turret
    ],
    engines: [
      { x: 0, y: -0.4, z: -0.5 }    // Main engine
    ],
    hardpoints: [
      { x: 0.2, y: 0.2, z: 0 },
      { x: -0.2, y: 0.2, z: 0 }
    ]
  } as ShipTypeConfig,
  
  corvette: {
    scale: SHIP_SCALE_CONFIG.SMALL_SHIP_SCALE,
    collisionRadius: SHIP_SCALE_CONFIG.SMALL_SHIP_SCALE * SHIP_SCALE_CONFIG.COLLISION_RADIUS_MULTIPLIER,
    turrets: [
      { x: 0.4, y: 0.2, z: 0.3 },
      { x: -0.4, y: 0.2, z: 0.3 },
      { x: 0, y: 0.2, z: -0.4 }
    ],
    engines: [
      { x: 0, y: -0.5, z: -0.6 },
      { x: 0.3, y: -0.3, z: -0.5 },
      { x: -0.3, y: -0.3, z: -0.5 }
    ],
    hardpoints: [
      { x: 0.3, y: 0.3, z: 0.2 },
      { x: -0.3, y: 0.3, z: 0.2 },
      { x: 0, y: 0.4, z: 0 }
    ]
  } as ShipTypeConfig,
  
  frigate: {
    scale: SHIP_SCALE_CONFIG.MEDIUM_SHIP_SCALE,
    collisionRadius: SHIP_SCALE_CONFIG.MEDIUM_SHIP_SCALE * SHIP_SCALE_CONFIG.COLLISION_RADIUS_MULTIPLIER,
    turrets: [
      { x: 0.6, y: 0.3, z: 0.4 },
      { x: -0.6, y: 0.3, z: 0.4 },
      { x: 0.4, y: 0.3, z: -0.5 },
      { x: -0.4, y: 0.3, z: -0.5 }
    ],
    engines: [
      { x: 0, y: -0.7, z: -0.8 },
      { x: 0.5, y: -0.5, z: -0.7 },
      { x: -0.5, y: -0.5, z: -0.7 }
    ],
    hardpoints: [
      { x: 0.4, y: 0.4, z: 0.3 },
      { x: -0.4, y: 0.4, z: 0.3 },
      { x: 0, y: 0.5, z: 0.2 },
      { x: 0.3, y: 0.2, z: -0.6 },
      { x: -0.3, y: 0.2, z: -0.6 }
    ]
  } as ShipTypeConfig,
  
  destroyer: {
    scale: SHIP_SCALE_CONFIG.LARGE_SHIP_SCALE,
    collisionRadius: SHIP_SCALE_CONFIG.LARGE_SHIP_SCALE * SHIP_SCALE_CONFIG.COLLISION_RADIUS_MULTIPLIER,
    turrets: [
      { x: 0.8, y: 0.4, z: 0.5 },
      { x: -0.8, y: 0.4, z: 0.5 },
      { x: 0.5, y: 0.4, z: -0.6 },
      { x: -0.5, y: 0.4, z: -0.6 },
      { x: 0, y: 0.6, z: 0.3 },
      { x: 0, y: 0.4, z: -0.8 }
    ],
    engines: [
      { x: 0, y: -0.9, z: -1.0 },
      { x: 0.6, y: -0.7, z: -0.9 },
      { x: -0.6, y: -0.7, z: -0.9 },
      { x: 0.4, y: -0.5, z: -0.8 },
      { x: -0.4, y: -0.5, z: -0.8 }
    ],
    hardpoints: [
      { x: 0.5, y: 0.5, z: 0.4 },
      { x: -0.5, y: 0.5, z: 0.4 },
      { x: 0, y: 0.7, z: 0.3 },
      { x: 0.4, y: 0.3, z: -0.7 },
      { x: -0.4, y: 0.3, z: -0.7 },
      { x: 0.6, y: 0.2, z: 0.6 },
      { x: -0.6, y: 0.2, z: 0.6 }
    ]
  } as ShipTypeConfig,
  
  carrier: {
    scale: SHIP_SCALE_CONFIG.LARGE_SHIP_SCALE,
    collisionRadius: SHIP_SCALE_CONFIG.LARGE_SHIP_SCALE * SHIP_SCALE_CONFIG.COLLISION_RADIUS_MULTIPLIER,
    turrets: [
      { x: 1.0, y: 0.5, z: 0.6 },
      { x: -1.0, y: 0.5, z: 0.6 },
      { x: 0.6, y: 0.5, z: -0.7 },
      { x: -0.6, y: 0.5, z: -0.7 },
      { x: 0, y: 0.7, z: 0.4 },
      { x: 0, y: 0.5, z: -1.0 },
      { x: 0.8, y: 0.3, z: 0.8 },
      { x: -0.8, y: 0.3, z: 0.8 }
    ],
    engines: [
      { x: 0, y: -1.1, z: -1.2 },
      { x: 0.8, y: -0.9, z: -1.1 },
      { x: -0.8, y: -0.9, z: -1.1 },
      { x: 0.5, y: -0.7, z: -1.0 },
      { x: -0.5, y: -0.7, z: -1.0 },
      { x: 0.3, y: -0.5, z: -0.9 },
      { x: -0.3, y: -0.5, z: -0.9 }
    ],
    hardpoints: [
      { x: 0.6, y: 0.6, z: 0.5 },
      { x: -0.6, y: 0.6, z: 0.5 },
      { x: 0, y: 0.8, z: 0.4 },
      { x: 0.5, y: 0.4, z: -0.8 },
      { x: -0.5, y: 0.4, z: -0.8 },
      { x: 0.7, y: 0.3, z: 0.7 },
      { x: -0.7, y: 0.3, z: 0.7 },
      { x: 0.4, y: 0.2, z: -0.9 },
      { x: -0.4, y: 0.2, z: -0.9 },
      { x: 0, y: 0.9, z: 0.2 }
    ]
  } as ShipTypeConfig
};

// Helper function to get ship configuration by type
export function getShipConfig(shipType: string): ShipTypeConfig | null {
  const config = SHIP_TYPE_CONFIGS[shipType as keyof typeof SHIP_TYPE_CONFIGS];
  return config || null;
}

// Helper function to calculate scaled collision radius
export function getScaledCollisionRadius(baseRadius: number, scale: number): number {
  return baseRadius * scale * SHIP_SCALE_CONFIG.COLLISION_RADIUS_MULTIPLIER;
}