import type { ShipHull } from '../types/index.js';

export type ShieldMaterialKind = 'hex' | 'transmission';

export interface ShieldVisualSettings {
  /** Multiplier applied to the model bounding-sphere radius. */
  margin?: number;
  /** Hex grid density used by the shield shader. */
  hexScale?: number;
  /** Edge width used by the shield shader. */
  edgeWidth?: number;
  /** Maximum final alpha for shield material (0..1). */
  maxAlpha?: number;
  /** What material to use for the shield: custom hex shader or drei MeshTransmissionMaterial */
  materialKind?: ShieldMaterialKind;
  /** Optional params for MeshTransmissionMaterial when materialKind==='transmission' */
  transmission?: {
    thickness?: number; // 0..1 typical
    chromaticAberration?: number;
    anisotropicBlur?: number;
    distortion?: number;
    distortionScale?: number;
    temporalDistortion?: number;
    attenuationDistance?: number;
    roughness?: number;
    clearcoat?: number;
    ior?: number; // index of refraction, e.g., 1.2
  };
}

export interface DebugVisualFlags {
  showTurretGizmos?: boolean;
  showMuzzleFlashes?: boolean;
}

export const DEBUG_VISUALS: DebugVisualFlags = {
  showTurretGizmos: false,
  showMuzzleFlashes: true,
};

// Tunable per-hull shield visuals; values are conservative defaults.
export const SHIELD_VISUALS: Record<ShipHull, ShieldVisualSettings> = {
  fighter: { margin: 1.01, hexScale: 48, edgeWidth: 0.1, maxAlpha: 0.5, materialKind: 'hex' },
  corvette: { margin: 1.01, hexScale: 48, edgeWidth: 0.1, maxAlpha: 0.5, materialKind: 'hex' },
  frigate: { margin: 1.01, hexScale: 48, edgeWidth: 0.1, maxAlpha: 0.5, materialKind: 'hex' },
  destroyer: { margin: 1.01, hexScale: 48, edgeWidth: 0.1, maxAlpha: 0.5, materialKind: 'hex' },
  carrier: { margin: 1.01, hexScale: 48, edgeWidth: 0.1, maxAlpha: 0.5, materialKind: 'hex' },
};

const DEFAULTS: Required<ShieldVisualSettings> = {
  margin: 1.12,
  hexScale: 12,
  edgeWidth: 0.1,
  maxAlpha: 0.5,
  materialKind: 'hex',
  transmission: {
    thickness: 0.6,
    chromaticAberration: 0.02,
    anisotropicBlur: 0.1,
    distortion: 0.1,
    distortionScale: 0.4,
    temporalDistortion: 0.1,
    attenuationDistance: 0.6,
    roughness: 0.1,
    clearcoat: 0.0,
    ior: 1.2,
  },
};

export function getShieldVisuals(hull: ShipHull): Required<ShieldVisualSettings> {
  const cfg = SHIELD_VISUALS[hull] ?? {};
  return {
    margin: cfg.margin ?? DEFAULTS.margin,
    hexScale: cfg.hexScale ?? DEFAULTS.hexScale,
    edgeWidth: cfg.edgeWidth ?? DEFAULTS.edgeWidth,
    maxAlpha: cfg.maxAlpha ?? DEFAULTS.maxAlpha,
    materialKind: cfg.materialKind ?? DEFAULTS.materialKind,
    transmission: {
      thickness: cfg.transmission?.thickness ?? DEFAULTS.transmission.thickness,
      chromaticAberration:
        cfg.transmission?.chromaticAberration ?? DEFAULTS.transmission.chromaticAberration,
      anisotropicBlur: cfg.transmission?.anisotropicBlur ?? DEFAULTS.transmission.anisotropicBlur,
      distortion: cfg.transmission?.distortion ?? DEFAULTS.transmission.distortion,
      distortionScale: cfg.transmission?.distortionScale ?? DEFAULTS.transmission.distortionScale,
      temporalDistortion:
        cfg.transmission?.temporalDistortion ?? DEFAULTS.transmission.temporalDistortion,
      attenuationDistance:
        cfg.transmission?.attenuationDistance ?? DEFAULTS.transmission.attenuationDistance,
      roughness: cfg.transmission?.roughness ?? DEFAULTS.transmission.roughness,
      clearcoat: cfg.transmission?.clearcoat ?? DEFAULTS.transmission.clearcoat,
      ior: cfg.transmission?.ior ?? DEFAULTS.transmission.ior,
    },
  };
}

// Convenience helper to globally override all hulls if needed in the future
export function setGlobalShieldMaterial(kind: ShieldMaterialKind): void {
  (Object.keys(SHIELD_VISUALS) as ShipHull[]).forEach((h) => {
    SHIELD_VISUALS[h] = { ...(SHIELD_VISUALS[h] ?? {}), materialKind: kind };
  });
}
