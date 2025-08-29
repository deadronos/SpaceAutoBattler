// Global game configuration
// Contains UI, gameplay constants, and other global settings
export interface GameConfig {
  // UI settings
  ui: {
    showDebugInfo: boolean;
    enableTrails: boolean;
    cameraFollow: boolean;
  };
  // Gameplay settings
  gameplay: {
    autoRespawn: boolean;
    formationSpacing: number;
    maxFleetsPerTeam: number;
  };
  // Performance settings
  performance: {
    enableLOD: boolean; // Level of Detail for distant objects
    maxParticles: number;
    particleLifetime: number;
  };
}

export const DefaultGameConfig: GameConfig = {
  ui: {
    showDebugInfo: true,
    enableTrails: true,
    cameraFollow: false,
  },
  gameplay: {
    autoRespawn: true,
    formationSpacing: 30,
    maxFleetsPerTeam: 10,
  },
  performance: {
    enableLOD: true,
    maxParticles: 1000,
    particleLifetime: 2.0,
  },
};