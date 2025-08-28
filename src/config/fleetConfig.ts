// Fleet positioning and spawning configuration
export interface FleetConfig {
  positioning: {
    leftMargin: number; // Margin from left edge for red team
    rightMargin: number; // Margin from right edge for blue team
    centerZOffset: number; // Z position offset from center
    rowSize: number; // Number of ships per row in formation
    spacing: number; // Spacing between ships in formation
  };
  spawning: {
    margin: number; // Margin from edges for random spawning
    spawnWidth: number; // Width of spawn area
    defaultFleetSize: number; // Default number of ships per fleet
  };
  cinematic: {
    optimalDistanceMultiplier: number; // Multiplier for cinematic distance calculation
  };
}

export const DefaultFleetConfig: FleetConfig = {
  positioning: {
    leftMargin: 150,
    rightMargin: 150,
    centerZOffset: 0, // Use simBounds.depth / 2
    rowSize: 8,
    spacing: 30,
  },
  spawning: {
    margin: 200,
    spawnWidth: 200,
    defaultFleetSize: 6,
  },
  cinematic: {
    optimalDistanceMultiplier: 1.5,
  },
};

// Export the default config as FleetConfig for backward compatibility
export const FleetConfig = DefaultFleetConfig;