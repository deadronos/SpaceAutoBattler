import { describe, it, expect } from 'vitest';
import { Vector3 } from 'three';
import {
  scaleRippleAmplitudes,
  filterSignificantRipples,
  coalesceRipples,
  sliceToMaxRipples,
  processRipplesForRendering,
} from '../../../src/components/ship/rippleUtils.js';
import type { ShieldRipple } from '../../../src/types/index.js';
import type { ShieldRippleTuning } from '../../../src/config/renderer.js';

describe('rippleUtils', () => {
  const createRipple = (amp: number, t0: number): ShieldRipple => ({
    dir: new Vector3(1, 0, 0),
    t0,
    amp,
  });

  describe('scaleRippleAmplitudes', () => {
    it('should scale amplitudes correctly', () => {
      const ripples = [createRipple(0.5, 0)];
      const scaled = scaleRippleAmplitudes(ripples, 2.0);
      expect(scaled).toHaveLength(1);
      expect(scaled[0].scaledAmp).toBe(Math.min(1.6, 0.25 + 0.5 * 2.0));
    });

    it('should clamp scaled amplitude to 1.6', () => {
      const ripples = [createRipple(2.0, 0)];
      const scaled = scaleRippleAmplitudes(ripples, 2.0);
      expect(scaled[0].scaledAmp).toBe(1.6);
    });

    it('should handle empty array', () => {
      const scaled = scaleRippleAmplitudes([], 2.0);
      expect(scaled).toHaveLength(0);
    });

    it('should preserve original ripple data', () => {
      const ripples = [createRipple(0.5, 1.5)];
      const scaled = scaleRippleAmplitudes(ripples, 2.0);
      expect(scaled[0].amp).toBe(0.5);
      expect(scaled[0].t0).toBe(1.5);
      expect(scaled[0].dir).toEqual(new Vector3(1, 0, 0));
    });
  });

  describe('filterSignificantRipples', () => {
    it('should filter ripples below threshold', () => {
      const ripples = [
        { dir: new Vector3(1, 0, 0), t0: 0, amp: 0.5, scaledAmp: 0.01 },
        { dir: new Vector3(0, 1, 0), t0: 1, amp: 0.5, scaledAmp: 0.05 },
        { dir: new Vector3(0, 0, 1), t0: 2, amp: 0.5, scaledAmp: 0.1 },
      ];
      const filtered = filterSignificantRipples(ripples, 0.02);
      expect(filtered).toHaveLength(2);
      expect(filtered[0].scaledAmp).toBe(0.05);
      expect(filtered[1].scaledAmp).toBe(0.1);
    });

    it('should handle empty array', () => {
      const filtered = filterSignificantRipples([], 0.02);
      expect(filtered).toHaveLength(0);
    });

    it('should keep ripples equal to threshold', () => {
      const ripples = [{ dir: new Vector3(1, 0, 0), t0: 0, amp: 0.5, scaledAmp: 0.02 }];
      const filtered = filterSignificantRipples(ripples, 0.02);
      expect(filtered).toHaveLength(1);
    });
  });

  describe('coalesceRipples', () => {
    it('should not coalesce ripples outside window', () => {
      const ripples = [
        { dir: new Vector3(1, 0, 0), t0: 0.0, amp: 0.5, scaledAmp: 1.0 },
        { dir: new Vector3(0, 1, 0), t0: 0.2, amp: 0.5, scaledAmp: 1.0 },
      ];
      const coalesced = coalesceRipples(ripples, 0.1);
      expect(coalesced).toHaveLength(2);
    });

    it('should coalesce ripples within window', () => {
      const ripples = [
        { dir: new Vector3(1, 0, 0), t0: 0.0, amp: 0.5, scaledAmp: 1.0 },
        { dir: new Vector3(0, 1, 0), t0: 0.05, amp: 0.5, scaledAmp: 1.0 },
      ];
      const coalesced = coalesceRipples(ripples, 0.1);
      expect(coalesced).toHaveLength(1);
      expect(coalesced[0].scaledAmp).toBe(Math.min(1.6, 1.0 + 1.0 * 0.6));
      expect(coalesced[0].t0).toBe(0.0);
    });

    it('should clamp coalesced amplitude to 1.6', () => {
      const ripples = [
        { dir: new Vector3(1, 0, 0), t0: 0.0, amp: 0.5, scaledAmp: 1.5 },
        { dir: new Vector3(0, 1, 0), t0: 0.05, amp: 0.5, scaledAmp: 1.5 },
      ];
      const coalesced = coalesceRipples(ripples, 0.1);
      expect(coalesced).toHaveLength(1);
      expect(coalesced[0].scaledAmp).toBe(1.6);
    });

    it('should handle empty array', () => {
      const coalesced = coalesceRipples([], 0.1);
      expect(coalesced).toHaveLength(0);
    });

    it('should handle single ripple', () => {
      const ripples = [{ dir: new Vector3(1, 0, 0), t0: 0.0, amp: 0.5, scaledAmp: 1.0 }];
      const coalesced = coalesceRipples(ripples, 0.1);
      expect(coalesced).toHaveLength(1);
      expect(coalesced[0].scaledAmp).toBe(1.0);
    });

    it('should handle multiple coalescing groups', () => {
      const ripples = [
        { dir: new Vector3(1, 0, 0), t0: 0.0, amp: 0.5, scaledAmp: 1.0 },
        { dir: new Vector3(0, 1, 0), t0: 0.02, amp: 0.5, scaledAmp: 1.0 },
        { dir: new Vector3(0, 0, 1), t0: 0.2, amp: 0.5, scaledAmp: 1.0 },
        { dir: new Vector3(1, 1, 0), t0: 0.22, amp: 0.5, scaledAmp: 1.0 },
      ];
      const coalesced = coalesceRipples(ripples, 0.05);
      expect(coalesced).toHaveLength(2);
    });
  });

  describe('sliceToMaxRipples', () => {
    it('should keep all ripples when count is below max', () => {
      const ripples = [
        { dir: new Vector3(1, 0, 0), t0: 0, amp: 0.5, scaledAmp: 1.0 },
        { dir: new Vector3(0, 1, 0), t0: 1, amp: 0.5, scaledAmp: 1.0 },
      ];
      const sliced = sliceToMaxRipples(ripples, 5);
      expect(sliced).toHaveLength(2);
    });

    it('should slice to max ripples keeping most recent', () => {
      const ripples = [
        { dir: new Vector3(1, 0, 0), t0: 0, amp: 0.5, scaledAmp: 1.0 },
        { dir: new Vector3(0, 1, 0), t0: 1, amp: 0.5, scaledAmp: 1.0 },
        { dir: new Vector3(0, 0, 1), t0: 2, amp: 0.5, scaledAmp: 1.0 },
        { dir: new Vector3(1, 1, 0), t0: 3, amp: 0.5, scaledAmp: 1.0 },
      ];
      const sliced = sliceToMaxRipples(ripples, 2);
      expect(sliced).toHaveLength(2);
      expect(sliced[0].t0).toBe(2);
      expect(sliced[1].t0).toBe(3);
    });

    it('should handle empty array', () => {
      const sliced = sliceToMaxRipples([], 3);
      expect(sliced).toHaveLength(0);
    });
  });

  describe('processRipplesForRendering', () => {
    const defaultTuning: ShieldRippleTuning = {
      maxRipples: 3,
      defaultSpeed: 3.1,
      baseWidth: 0.1,
      ampScale: 2.0,
      coalesceWindow: 0.05,
      rippleLife: 0.9,
      minRenderAmp: 0.1,
      blendMode: 1,
      ignoreMaxAlpha: false,
      colorMul: 0.5,
      strength: 0.7,
      displacementScale: 0.15,
    };

    it('should process empty array', () => {
      const processed = processRipplesForRendering([], defaultTuning);
      expect(processed).toHaveLength(0);
    });

    it('should filter out low amplitude ripples', () => {
      const ripples = [createRipple(-1.0, 0), createRipple(0.5, 1)];
      const processed = processRipplesForRendering(ripples, defaultTuning);
      expect(processed.length).toBeLessThan(ripples.length);
    });

    it('should enforce max ripples limit', () => {
      const ripples = [
        createRipple(0.5, 0),
        createRipple(0.5, 0.1),
        createRipple(0.5, 0.2),
        createRipple(0.5, 0.3),
        createRipple(0.5, 0.4),
      ];
      const processed = processRipplesForRendering(ripples, defaultTuning);
      expect(processed.length).toBeLessThanOrEqual(defaultTuning.maxRipples);
    });

    it('should return processed ripples with correct structure', () => {
      const ripples = [createRipple(0.5, 1.5)];
      const processed = processRipplesForRendering(ripples, defaultTuning);
      expect(processed.length).toBeGreaterThan(0);
      expect(processed[0]).toHaveProperty('dir');
      expect(processed[0]).toHaveProperty('t0');
      expect(processed[0]).toHaveProperty('amp');
      expect(processed[0].dir).toBeInstanceOf(Vector3);
    });

    it('should coalesce nearby ripples', () => {
      const ripples = [createRipple(0.5, 0.0), createRipple(0.5, 0.02), createRipple(0.5, 0.03)];
      const processed = processRipplesForRendering(ripples, defaultTuning);
      expect(processed.length).toBeLessThan(ripples.length);
    });
  });
});
