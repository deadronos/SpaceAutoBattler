export interface BloomGroupConfig {
  /** Optional override for bloom intensity for this group. */
  intensity?: number;
  /** Optional override for luminance threshold. */
  threshold?: number;
  /** Optional override for smoothing around the threshold. */
  smoothing?: number;
}

export interface PostprocessingConfig {
  /** Luminance threshold for bloom (higher = fewer pixels bloom) */
  bloomThreshold: number;
  /** Smoothing applied around the threshold (0..1) */
  bloomSmoothing: number;
  /** Global intensity multiplier for bloom effect */
  bloomIntensity: number;
  /** Whether the selective bloom pass should ignore the scene background color. */
  bloomIgnoreBackground: boolean;
  /** Default bloom group name used when components opt-in without explicit configuration. */
  bloomDefaultGroup: string;
  /** Starting render layer used when allocating `Selection` layers for bloom groups. */
  bloomLayerStart: number;
  /** Per-group configuration overrides for selective bloom. */
  bloomGroups: Record<string, BloomGroupConfig>;
}

export const POSTPROCESSING_CONFIG: PostprocessingConfig = {
  bloomThreshold: 0.8,
  bloomSmoothing: 0.001,
  bloomIntensity: 0.1,
  bloomIgnoreBackground: false,
  bloomDefaultGroup: 'default',
  bloomLayerStart: 11,
  bloomGroups: {
    default: {
      threshold: 0.9,
      intensity: 0.5,
    },
    engines: {
      intensity: 10.35,
      smoothing: 0.008,
      threshold: 0.8,
    },
    shields: {
      intensity: 0.3,
      smoothing: 0.02,
      threshold: 2.5,
    },
    projectiles: {
      intensity: 5.25,
      smoothing: 0.006,
      threshold: 0.9,
    },
    explosions: {
      intensity: 3.6,
      smoothing: 0.035,
      threshold: 1.0,
    },
    muzzleFlashes: {
      intensity: 10.4,
      smoothing: 0.01,
      threshold: 1.0,
    },
    star: {
      intensity: 2.0,
      smoothing: 0.01,
      threshold: 1.2,
    },
  },
};
