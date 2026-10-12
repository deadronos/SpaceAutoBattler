import { describe, it, expect, beforeEach, afterEach } from 'vite-plus/test';
import type { MotionVisualConfig } from '../../src/types/gameplay.js';
import type { VisualDetailLevel } from '../../src/types/index.js';
import { RENDERER_VISUAL_CONFIG } from '../../src/config/renderer.js';
import { resolveInterpolationPolicy } from '../../src/hooks/interpolation/detailPolicy.js';

function createVisualConfig(overrides: Partial<MotionVisualConfig> = {}): MotionVisualConfig {
  return {
    enabled: true,
    position: { k: 12 },
    rotation: { k: 30 },
    bank: { k: 18, maxDeg: 32, useCriticallyDamped: true },
    bob: { enabled: true, baseAmp: 0.08, freq: 1.2, speedScale: 1, maxAmp: 0.22 },
    teleportDistance: 35,
    ...overrides,
  };
}

describe('resolveInterpolationPolicy', () => {
  let originalConfig: typeof RENDERER_VISUAL_CONFIG;

  beforeEach(() => {
    originalConfig = { ...RENDERER_VISUAL_CONFIG };
    RENDERER_VISUAL_CONFIG.enableShipVisualSmoothing = true;
    RENDERER_VISUAL_CONFIG.enableShipBob = true;
    RENDERER_VISUAL_CONFIG.enableShipBanking = true;
    RENDERER_VISUAL_CONFIG.performanceTier = 'high';
  });

  afterEach(() => {
    Object.assign(RENDERER_VISUAL_CONFIG, originalConfig);
  });

  describe('effective detail resolution', () => {
    const cases: Array<{
      performanceTier: VisualDetailLevel;
      entityDetail: VisualDetailLevel;
      expected: VisualDetailLevel;
    }> = [
      { performanceTier: 'high', entityDetail: 'high', expected: 'high' },
      { performanceTier: 'high', entityDetail: 'medium', expected: 'medium' },
      { performanceTier: 'high', entityDetail: 'low', expected: 'low' },
      { performanceTier: 'medium', entityDetail: 'high', expected: 'medium' },
      { performanceTier: 'medium', entityDetail: 'medium', expected: 'medium' },
      { performanceTier: 'medium', entityDetail: 'low', expected: 'low' },
      { performanceTier: 'low', entityDetail: 'high', expected: 'low' },
      { performanceTier: 'low', entityDetail: 'medium', expected: 'low' },
      { performanceTier: 'low', entityDetail: 'low', expected: 'low' },
    ];

    for (const { performanceTier, entityDetail, expected } of cases) {
      it(`clamps ${entityDetail} detail under the ${performanceTier} tier to ${expected}`, () => {
        RENDERER_VISUAL_CONFIG.performanceTier = performanceTier;
        const policy = resolveInterpolationPolicy(createVisualConfig(), entityDetail);
        expect(policy.effectiveDetail).toBe(expected);
      });
    }
  });

  describe('smoothing gating', () => {
    it('disables smoothing for low effective detail', () => {
      RENDERER_VISUAL_CONFIG.performanceTier = 'low';
      const policy = resolveInterpolationPolicy(createVisualConfig(), 'high');
      expect(policy.smoothingEnabled).toBe(false);
    });

    it('disables smoothing when the global toggle is off', () => {
      RENDERER_VISUAL_CONFIG.enableShipVisualSmoothing = false;
      const policy = resolveInterpolationPolicy(createVisualConfig(), 'high');
      expect(policy.smoothingEnabled).toBe(false);
    });

    it('disables smoothing when the hull opts out', () => {
      const policy = resolveInterpolationPolicy(createVisualConfig({ enabled: false }), 'high');
      expect(policy.smoothingEnabled).toBe(false);
    });

    it('enables smoothing for medium and high effective detail by default', () => {
      expect(resolveInterpolationPolicy(createVisualConfig(), 'high').smoothingEnabled).toBe(true);
      expect(resolveInterpolationPolicy(createVisualConfig(), 'medium').smoothingEnabled).toBe(
        true,
      );
    });
  });

  describe('bob gating', () => {
    it('enables bob only at high effective detail', () => {
      expect(resolveInterpolationPolicy(createVisualConfig(), 'high').bobEnabled).toBe(true);
      expect(resolveInterpolationPolicy(createVisualConfig(), 'medium').bobEnabled).toBe(false);
      expect(resolveInterpolationPolicy(createVisualConfig(), 'low').bobEnabled).toBe(false);
    });

    it('disables bob when the global toggle is off', () => {
      RENDERER_VISUAL_CONFIG.enableShipBob = false;
      expect(resolveInterpolationPolicy(createVisualConfig(), 'high').bobEnabled).toBe(false);
    });

    it('disables bob when the hull opts out', () => {
      const visual = createVisualConfig({ bob: { enabled: false } });
      expect(resolveInterpolationPolicy(visual, 'high').bobEnabled).toBe(false);
    });

    it('requires smoothing to be enabled for bob', () => {
      RENDERER_VISUAL_CONFIG.enableShipVisualSmoothing = false;
      expect(resolveInterpolationPolicy(createVisualConfig(), 'high').bobEnabled).toBe(false);
    });
  });

  describe('banking mode resolution', () => {
    it('resolves criticallyDamped for high detail when requested', () => {
      const visual = createVisualConfig({
        bank: { k: 18, maxDeg: 32, useCriticallyDamped: true },
      });
      expect(resolveInterpolationPolicy(visual, 'high').bankingMode).toBe('criticallyDamped');
    });

    it('resolves simple for medium detail even when critically damped is requested', () => {
      const visual = createVisualConfig({
        bank: { k: 18, maxDeg: 32, useCriticallyDamped: true },
      });
      expect(resolveInterpolationPolicy(visual, 'medium').bankingMode).toBe('simple');
    });

    it('resolves simple when critically damped is not requested', () => {
      const visual = createVisualConfig({
        bank: { k: 18, maxDeg: 32, useCriticallyDamped: false },
      });
      expect(resolveInterpolationPolicy(visual, 'high').bankingMode).toBe('simple');
    });

    it('disables banking for low detail', () => {
      expect(resolveInterpolationPolicy(createVisualConfig(), 'low').bankingMode).toBe('disabled');
    });

    it('disables banking when the global toggle is off', () => {
      RENDERER_VISUAL_CONFIG.enableShipBanking = false;
      expect(resolveInterpolationPolicy(createVisualConfig(), 'high').bankingMode).toBe('disabled');
    });

    it('disables banking when no bank config is present', () => {
      const visual = createVisualConfig({ bank: undefined });
      expect(resolveInterpolationPolicy(visual, 'high').bankingMode).toBe('disabled');
    });

    it('disables banking when the max bank angle is zero', () => {
      const visual = createVisualConfig({ bank: { k: 18, maxDeg: 0 } });
      expect(resolveInterpolationPolicy(visual, 'high').bankingMode).toBe('disabled');
    });

    it('disables banking when visual config is undefined', () => {
      expect(resolveInterpolationPolicy(undefined, 'high').bankingMode).toBe('disabled');
    });
  });

  it('is deterministic across repeated calls with identical inputs', () => {
    const visual = createVisualConfig();
    const first = resolveInterpolationPolicy(visual, 'high');
    const second = resolveInterpolationPolicy(visual, 'high');
    expect(second).toEqual(first);
  });
});
