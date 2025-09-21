import type { ShipHull } from '../types/index.js';

export interface ShieldVisualSettings {
  /** Multiplier applied to the model bounding-sphere radius. */
  margin?: number;
  /** Hex grid density used by the shield shader. */
  hexScale?: number;
  /** Edge width used by the shield shader. */
  edgeWidth?: number;
}

// Tunable per-hull shield visuals; values are conservative defaults.
export const SHIELD_VISUALS: Record<ShipHull, ShieldVisualSettings> = {
  fighter:   { margin: 1.12, hexScale: 12, edgeWidth: 0.10 },
  corvette:  { margin: 1.12, hexScale: 12, edgeWidth: 0.10 },
  frigate:   { margin: 1.12, hexScale: 12, edgeWidth: 0.10 },
  destroyer: { margin: 1.13, hexScale: 12, edgeWidth: 0.10 },
  carrier:   { margin: 1.14, hexScale: 12, edgeWidth: 0.10 },
};

const DEFAULTS: Required<ShieldVisualSettings> = {
  margin: 1.12,
  hexScale: 12,
  edgeWidth: 0.10,
};

export function getShieldVisuals(hull: ShipHull): Required<ShieldVisualSettings> {
  const cfg = SHIELD_VISUALS[hull] ?? {};
  return {
    margin: cfg.margin ?? DEFAULTS.margin,
    hexScale: cfg.hexScale ?? DEFAULTS.hexScale,
    edgeWidth: cfg.edgeWidth ?? DEFAULTS.edgeWidth,
  };
}
