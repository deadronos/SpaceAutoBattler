// Carrier spawn and fighter management configuration
export interface CarrierSpawnConfig {
  fighterSpawn: {
    offsetDistance: number; // Distance from carrier to spawn fighter
    angleRandomization: number; // Randomization factor for spawn angle (0-1)
    baseCooldown: number; // Base cooldown between spawns
  };
  fighter: {
    initialCooldown: number; // Initial cooldown when fighter is spawned
  };
}

export const DefaultCarrierSpawnConfig: CarrierSpawnConfig = {
  fighterSpawn: {
    offsetDistance: 24,
    angleRandomization: 0.6,
    baseCooldown: 6,
  },
  fighter: {
    initialCooldown: 1.0,
  },
};

// Export the default config as CarrierSpawnConfig for backward compatibility
export const CarrierSpawnConfig = DefaultCarrierSpawnConfig;