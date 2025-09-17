import type {
  EffectsQualityConfig,
  EffectsQualityGovernorConfig,
  EffectsQualityLevel,
} from '../config/rendererConfig.js';

export interface EffectsGovernorHooks {
  applyQuality: (quality: EffectsQualityLevel) => void;
  setParticlesEnabled: (enabled: boolean) => void;
  setPostprocessingEnabled: (enabled: boolean) => void;
  log?: (message: string, details?: Record<string, unknown>) => void;
}

export interface EffectsGovernorOptions {
  config: EffectsQualityConfig;
  initialParticlesEnabled: boolean;
  initialPostprocessingEnabled: boolean;
  hooks: EffectsGovernorHooks;
}

export interface EffectsGovernor {
  update: (frameMs: number) => void;
  reset: () => void;
  areParticlesEnabled: () => boolean;
  isPostprocessingEnabled: () => boolean;
  currentQuality: () => EffectsQualityLevel;
  getAverageFrameMs: () => number;
  getSampleCount: () => number;
}

function clampConfig(cfg: EffectsQualityGovernorConfig): EffectsQualityGovernorConfig {
  return {
    ...cfg,
    frameTimeBudgetMs: Math.max(1, cfg.frameTimeBudgetMs || 1),
    sampleWindow: Math.max(1, Math.floor(cfg.sampleWindow || 1)),
    triggerThreshold: Math.max(1, Math.floor(cfg.triggerThreshold || 1)),
    recoverThreshold: Math.max(1, Math.floor(cfg.recoverThreshold || 1)),
    resumeBelowMs:
      typeof cfg.resumeBelowMs === 'number'
        ? Math.max(0, cfg.resumeBelowMs)
        : Math.max(0, Math.floor(cfg.frameTimeBudgetMs * 0.85)),
    degradeQuality: cfg.degradeQuality ?? 'low',
    recoverQuality: cfg.recoverQuality ?? 'high',
  };
}

export function createEffectsGovernor(options: EffectsGovernorOptions): EffectsGovernor {
  const { config } = options;
  const governor = clampConfig(config.governor);

  let particlesEnabled = !!options.initialParticlesEnabled;
  let postprocessingEnabled = !!options.initialPostprocessingEnabled;
  let currentQuality: EffectsQualityLevel = config.defaultQuality;
  let degraded = false;
  let sampleSum = 0;
  const samples: number[] = [];
  let overBudgetStreak = 0;
  let underBudgetStreak = 0;

  const applyQuality = (quality: EffectsQualityLevel) => {
    if (currentQuality === quality) return;
    currentQuality = quality;
    try {
      options.hooks.applyQuality(quality);
    } catch (_err) {
      void _err;
    }
  };

  const setParticles = (enabled: boolean) => {
    if (particlesEnabled === enabled) return;
    particlesEnabled = enabled;
    try {
      options.hooks.setParticlesEnabled(enabled);
    } catch (_err) {
      void _err;
    }
  };

  const setPostprocessing = (enabled: boolean) => {
    if (postprocessingEnabled === enabled) return;
    postprocessingEnabled = enabled;
    try {
      options.hooks.setPostprocessingEnabled(enabled);
    } catch (_err) {
      void _err;
    }
  };

  const logTransition = (message: string, details: Record<string, unknown>) => {
    if (!governor.logTransitions || !options.hooks.log) return;
    try {
      options.hooks.log(message, details);
    } catch (_err) {
      void _err;
    }
  };

  const resetState = () => {
    degraded = false;
    overBudgetStreak = 0;
    underBudgetStreak = 0;
    samples.length = 0;
    sampleSum = 0;
    currentQuality = config.defaultQuality;
    setParticles(!!options.initialParticlesEnabled);
    setPostprocessing(!!options.initialPostprocessingEnabled);
    try {
      options.hooks.applyQuality(currentQuality);
    } catch (_err) {
      void _err;
    }
  };

  // Apply initial quality immediately so downstream systems can align.
  try {
    options.hooks.applyQuality(currentQuality);
  } catch (_err) {
    void _err;
  }

  const update = (frameMs: number) => {
    if (!governor.enabled) {
      return;
    }
    if (!Number.isFinite(frameMs) || frameMs <= 0) {
      return;
    }

    samples.push(frameMs);
    sampleSum += frameMs;
    if (samples.length > governor.sampleWindow) {
      const removed = samples.shift();
      if (removed !== undefined) {
        sampleSum -= removed;
      }
    }

    if (samples.length < governor.sampleWindow) {
      return;
    }

    const average = sampleSum / samples.length;

    if (!degraded) {
      if (average >= governor.frameTimeBudgetMs) {
        overBudgetStreak += 1;
      } else {
        overBudgetStreak = 0;
      }

      if (overBudgetStreak >= governor.triggerThreshold) {
        degraded = true;
        overBudgetStreak = 0;
        underBudgetStreak = 0;
        applyQuality(governor.degradeQuality);
        if (governor.disableParticles) {
          setParticles(false);
        }
        if (governor.disablePostprocessing) {
          setPostprocessing(false);
        }
        logTransition('degraded', { average, frameMs, samples: samples.length });
      }
    } else {
      if (average <= (governor.resumeBelowMs ?? governor.frameTimeBudgetMs)) {
        underBudgetStreak += 1;
      } else {
        underBudgetStreak = 0;
      }

      if (underBudgetStreak >= governor.recoverThreshold) {
        degraded = false;
        underBudgetStreak = 0;
        overBudgetStreak = 0;
        applyQuality(governor.recoverQuality ?? config.defaultQuality);
        if (governor.disableParticles) {
          setParticles(!!options.initialParticlesEnabled);
        }
        if (governor.disablePostprocessing) {
          setPostprocessing(!!options.initialPostprocessingEnabled);
        }
        logTransition('recovered', { average, frameMs, samples: samples.length });
      }
    }
  };

  const getAverageFrameMs = () => {
    if (samples.length === 0) return 0;
    return sampleSum / samples.length;
  };

  return {
    update,
    reset: resetState,
    areParticlesEnabled: () => particlesEnabled,
    isPostprocessingEnabled: () => postprocessingEnabled,
    currentQuality: () => currentQuality,
    getAverageFrameMs,
    getSampleCount: () => samples.length,
  };
}
