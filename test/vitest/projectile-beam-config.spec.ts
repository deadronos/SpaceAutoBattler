import { describe, expect, it } from 'vitest';
import {
  PROJECTILE_CONFIG,
  getProjectileBeamConfig,
  resolveBeamFadeConfig,
} from '../../src/config/projectiles.js';

describe('resolveBeamFadeConfig', () => {
  it('returns undefined when overrides are missing or effectively zero', () => {
    expect(resolveBeamFadeConfig()).toBeUndefined();
    expect(resolveBeamFadeConfig({ strength: 0, exponent: 2 })).toBeUndefined();
    expect(resolveBeamFadeConfig({ strength: 5e-4, exponent: 3 })).toBeUndefined();
  });

  it('clamps strength and exponent into supported ranges', () => {
    const result = resolveBeamFadeConfig({ strength: 2.4, exponent: 12 });
    expect(result).toEqual({ strength: 1, exponent: 6 });
  });

  it('defaults invalid values to disabling fade', () => {
    expect(resolveBeamFadeConfig({ strength: -1, exponent: 0.5 })).toBeUndefined();
  });
});

describe('getProjectileBeamConfig', () => {
  it('returns default beam config without fade by default', () => {
    const config = getProjectileBeamConfig('beam:laser');
    expect(config?.fade).toBeUndefined();
  });

  it('sanitises fade overrides from projectile config', () => {
    const key = 'beam:test-fade';
    const original = PROJECTILE_CONFIG[key];
    PROJECTILE_CONFIG[key] = {
      visualScale: 1,
      beam: {
        ttl: 0.2,
        length: 25,
        width: 0.6,
        fade: { strength: 1.4, exponent: 0.3 },
      },
    };

    const config = getProjectileBeamConfig(key);
    expect(config).toBeDefined();
    expect(config?.fade).toEqual({ strength: 1, exponent: 1 });

    if (original) {
      PROJECTILE_CONFIG[key] = original;
    } else {
      delete PROJECTILE_CONFIG[key];
    }
  });
});
