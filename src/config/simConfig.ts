import type { BoundaryBehavior } from "./types";

export interface SimConfig {
  DT_MS: number;
  MAX_ACC_MS: number;
  bounds: { W: number; H: number };
  friction: number; // Velocity damping factor for ships
}

export const SIM: SimConfig = {
  DT_MS: 16,
  MAX_ACC_MS: 250,
  bounds: { W: 1920, H: 1080 }, // Use LOGICAL_MAP for default bounds
  friction: 0.98,
};
// boundaryBehavior: Tactical impact and pruning rationale
// - 'remove': Ships/bullets are eliminated at map edge; punishes edge play, rewards central control. Pruning is immediate for out-of-bounds entities.
// - 'wrap': Ships/bullets reappear on opposite edge; enables edge escapes, flanking via wrap, and kiting around boundaries. Pruning only occurs for expired entities.
// - 'bounce': Ships/bullets reflect off edge; supports tactical repositioning, edge denial, and hit-and-run. Pruning is immediate for expired entities.
// All entities, particles, and events are pruned immediately upon destruction, expiration, or leaving bounds, ensuring robust cleanup and tactical consistency.
export const boundaryBehavior: {
  ships: BoundaryBehavior;
  bullets: BoundaryBehavior;
} = {
  ships: "wrap",
  bullets: "remove",
};

export const progression = {
  xpPerDamage: 1,
  xpPerKill: 50,
  xpToLevel: (level: number) => 100 + level * 50,
};

export const LOGICAL_MAP = { W: 1920, H: 1080 };

export function getDefaultBounds() {
  // Fixed logical map size for simulation and rendering
  return { W: LOGICAL_MAP.W, H: LOGICAL_MAP.H };
}

export default {
  SIM,
  progression,
  boundaryBehavior,
  LOGICAL_MAP,
  getDefaultBounds,
};
