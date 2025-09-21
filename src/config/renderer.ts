import type { ShipHull } from '../types/index.js';

export interface ShieldVisualSettings {
  /** Multiplier applied to the model bounding-sphere radius. */
  margin?: number;
  /** Hex grid density used by the shield shader. */
  hexScale?: number;
  /** Edge width used by the shield shader. */
  edgeWidth?: number;
  /** Maximum final alpha for shield material (0..1). */
  maxAlpha?: number;
}

// Tunable per-hull shield visuals; values are conservative defaults.
export const SHIELD_VISUALS: Record<ShipHull, ShieldVisualSettings> = {
  fighter:   { margin: 1.01, hexScale: 48, edgeWidth: 0.10, maxAlpha: 0.5 },
  corvette:  { margin: 1.01, hexScale: 48, edgeWidth: 0.10, maxAlpha: 0.5 },
  frigate:   { margin: 1.01, hexScale: 48, edgeWidth: 0.10, maxAlpha: 0.5 },
  destroyer: { margin: 1.01, hexScale: 48, edgeWidth: 0.10, maxAlpha: 0.5 },
  carrier:   { margin: 1.01, hexScale: 48, edgeWidth: 0.10, maxAlpha: 0.5 },
};

const DEFAULTS: Required<ShieldVisualSettings> = {
  margin: 1.12,
  hexScale: 12,
  edgeWidth: 0.10,
  maxAlpha: 0.5,
};

export function getShieldVisuals(hull: ShipHull): Required<ShieldVisualSettings> {
  const cfg = SHIELD_VISUALS[hull] ?? {};
  return {
    margin: cfg.margin ?? DEFAULTS.margin,
    hexScale: cfg.hexScale ?? DEFAULTS.hexScale,
    edgeWidth: cfg.edgeWidth ?? DEFAULTS.edgeWidth,
    maxAlpha: cfg.maxAlpha ?? DEFAULTS.maxAlpha,
  };
}
