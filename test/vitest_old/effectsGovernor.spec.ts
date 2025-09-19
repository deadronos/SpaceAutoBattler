import { describe, it, expect } from 'vitest';
import { createEffectsGovernor } from '../../src/renderer/effectsGovernor.js';
import type { EffectsQualityConfig } from '../../src/config/rendererConfig.js';

describe('effectsGovernor', () => {
  const baseConfig: EffectsQualityConfig = {
    defaultQuality: 'high',
    governor: {
      enabled: true,
      frameTimeBudgetMs: 10,
      sampleWindow: 2,
      triggerThreshold: 2,
      recoverThreshold: 2,
      resumeBelowMs: 6,
      disableParticles: true,
      disablePostprocessing: true,
      degradeQuality: 'low',
      recoverQuality: 'high',
      logTransitions: false,
    },
  };

  it('degrades quality when frames exceed budget for sustained window', () => {
    const actions: string[] = [];
    const governor = createEffectsGovernor({
      config: baseConfig,
      initialParticlesEnabled: true,
      initialPostprocessingEnabled: true,
      hooks: {
        applyQuality: (quality) => actions.push(`quality:${quality}`),
        setParticlesEnabled: (enabled) => actions.push(`particles:${enabled}`),
        setPostprocessingEnabled: (enabled) => actions.push(`post:${enabled}`),
      },
    });

    actions.length = 0;

    governor.update(12);
    governor.update(12);
    governor.update(12);

    expect(actions).toContain('quality:low');
    expect(actions).toContain('particles:false');
    expect(actions).toContain('post:false');
    expect(governor.areParticlesEnabled()).toBe(false);
    expect(governor.isPostprocessingEnabled()).toBe(false);
    expect(governor.currentQuality()).toBe('low');
  });

  it('recovers quality after sustained improvement', () => {
    const actions: string[] = [];
    const governor = createEffectsGovernor({
      config: baseConfig,
      initialParticlesEnabled: true,
      initialPostprocessingEnabled: true,
      hooks: {
        applyQuality: (quality) => actions.push(`quality:${quality}`),
        setParticlesEnabled: (enabled) => actions.push(`particles:${enabled}`),
        setPostprocessingEnabled: (enabled) => actions.push(`post:${enabled}`),
      },
    });

    actions.length = 0;

    governor.update(12);
    governor.update(12);
    governor.update(12);

    actions.length = 0;

    governor.update(5);
    governor.update(5);
    governor.update(5);

    expect(actions).toContain('quality:high');
    expect(actions).toContain('particles:true');
    expect(actions).toContain('post:true');
    expect(governor.areParticlesEnabled()).toBe(true);
    expect(governor.isPostprocessingEnabled()).toBe(true);
    expect(governor.currentQuality()).toBe('high');
  });

  it('no-ops when governor disabled', () => {
    const disabledConfig: EffectsQualityConfig = {
      ...baseConfig,
      governor: { ...baseConfig.governor, enabled: false },
    };
    const actions: string[] = [];
    const governor = createEffectsGovernor({
      config: disabledConfig,
      initialParticlesEnabled: true,
      initialPostprocessingEnabled: true,
      hooks: {
        applyQuality: (quality) => actions.push(`quality:${quality}`),
        setParticlesEnabled: (enabled) => actions.push(`particles:${enabled}`),
        setPostprocessingEnabled: (enabled) => actions.push(`post:${enabled}`),
      },
    });

    actions.length = 0;

    governor.update(40);
    governor.update(40);
    governor.update(40);

    expect(actions).toEqual([]);
    expect(governor.areParticlesEnabled()).toBe(true);
    expect(governor.isPostprocessingEnabled()).toBe(true);
    expect(governor.getSampleCount()).toBe(0);
  });
});
