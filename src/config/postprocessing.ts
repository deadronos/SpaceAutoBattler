import type { N8AOQualityMode } from 'n8ao';

export interface BloomGroupConfig {
  /** Optional override for bloom intensity for this group. */
  intensity?: number;
  /** Optional override for luminance threshold. */
  threshold?: number;
  /** Optional override for smoothing around the threshold. */
  smoothing?: number;
}

export interface AmbientOcclusionConfig {
  /** Master enable for the AO pass. */
  enabled: boolean;
  /** Render AO at half resolution (perf, per issue). */
  halfRes: boolean;
  /** N8AO quality preset. */
  quality: N8AOQualityMode;
  /** AO radius in world units (ship scale). */
  aoRadius: number;
  /** How fast AO fades with distance relative to radius. */
  distanceFalloff: number;
  /** Artistic occlusion strength (pow curve). */
  intensity: number;
  /** Occlusion color (sRGB hex). */
  color: string;
  /**
   * Transparency-aware mode. Optional; when omitted it falls back to `false`.
   * The shipped config keeps it `false`: N8AO auto-detect would enable it for
   * this scene (many transparent objects) and render the scene twice more per
   * frame.
   */
  transparencyAware?: boolean;
}

export interface ColorPipelineConfig {
  /** Master toggle. `false` reproduces the legacy sRGB / NoToneMapping pipeline exactly. */
  enabled: boolean;
  /** Tone-mapping operator applied as the last effect before FXAA. */
  toneMapping: 'agx' | 'aces' | 'neutral';
  /** Pre-tone-map exposure multiplier fed to the tone-mapping effect. */
  exposure: number;
  /** Multiplier applied to every bloom group intensity when the pipeline is on. */
  bloomScale: number;
  /** Optional asset-free vignette grade. */
  vignette: { enabled: boolean; offset: number; darkness: number };
}

export interface PostprocessingConfig {
  /** Ambient-occlusion (N8AO) configuration. */
  ao: AmbientOcclusionConfig;
  /**
   * Linear-HDR + tone-mapping pipeline. Enabled by default: the composer renders
   * into a linear (`NoColorSpace`) HalfFloat target and applies a tone-mapping
   * effect immediately before FXAA. `enabled: false` reproduces the legacy
   * sRGB / `NoToneMapping` pipeline exactly.
   */
  colorPipeline: ColorPipelineConfig;
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

/**
 * Configuration for post-processing effects, primarily bloom.
 */
export const POSTPROCESSING_CONFIG: PostprocessingConfig = {
  // Provisional values; to be tuned during visual review (#646).
  ao: {
    enabled: true,
    halfRes: true,
    quality: 'Medium',
    aoRadius: 4,
    distanceFalloff: 1.0,
    intensity: 5,
    color: '#000000',
    transparencyAware: false,
  },
  // Linear-HDR + tone-mapping pipeline (#645). `bloomScale` is the single knob
  // for bloom rebalance: the linear-HDR target preserves emissive values > 1, so
  // bloom is driven ~10x harder than the legacy sRGB path. It multiplies every
  // group intensity in `buildEffects`; the per-group values stay untouched so
  // the rebalance is revertible by toggling the pipeline off. Reverting the
  // whole look is a single `enabled: false`.
  colorPipeline: {
    enabled: true,
    toneMapping: 'agx',
    exposure: 1,
    bloomScale: 0.1,
    vignette: { enabled: false, offset: 0.3, darkness: 0.6 },
  },
  bloomThreshold: 0.8,
  bloomSmoothing: 0.001,
  bloomIntensity: 0.1,
  bloomIgnoreBackground: false,
  bloomDefaultGroup: 'default',
  bloomLayerStart: 11,
  // Per-group `threshold`/`smoothing` are the sign-off tuning surface for the
  // linear-HDR look: values > 1 are now preserved, so thresholds may need
  // raising. Do not change them in this PR unless sign-off requests it.
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
