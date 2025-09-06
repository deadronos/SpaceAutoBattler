import type { SimBounds } from '../types/index.js';

// Boundary behavior types
export type BoundaryBehavior = 'bounce' | 'wrap' | 'remove';

// Simulation-specific configuration
// Contains only physics, timing, and simulation bounds settings
export interface SimConfig {
  simBounds: SimBounds;
  tickRate: number; // ticks per second
  maxEntities: number;
  // Physics settings
  bulletLifetime: number; // seconds
  maxSimulationSteps: number; // prevent spiral of death
  useBVH: boolean;
  // AI settings
  targetUpdateRate: number; // how often AI updates targets (seconds)
  // Boundary settings
  boundaryBehavior: {
    ships: BoundaryBehavior;
    bullets: BoundaryBehavior;
  };
  // Spatial grid settings for performance optimization
  spatialGrid: {
    cellSize: number; // size of each spatial grid cell in world units
  };
  // RNG settings
  seed: string;
  useTimeBasedSeed: boolean;
}

export const DefaultSimConfig: SimConfig = {
  simBounds: { width: 1920, height: 1920, depth: 1920 },
  tickRate: 10,
  maxEntities: 5000,
  bulletLifetime: 3.0, // bullets live for 3 seconds
  maxSimulationSteps: 5, // max steps per frame to prevent spiral of death
  useBVH: true, // use Bounding Volume Hierarchy for collision detection
  targetUpdateRate: 0.5, // AI updates targets every 0.5 seconds
  boundaryBehavior: {
    ships: 'bounce', // ships bounce off boundaries
    bullets: 'remove', // bullets are removed when hitting boundaries
  },
  spatialGrid: {
    cellSize: 64, // optimal cell size for AI neighbor searches
  },
  seed: 'SPACE-001',
  useTimeBasedSeed: false,
};
