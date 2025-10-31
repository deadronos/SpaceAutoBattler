import { describe, it, expect } from 'vitest';
import { Vector3 } from 'three';
import {
  easeOutQuad,
  getCachedColor,
  getDerived,
  randomUnitVector,
} from '../../../src/components/explosions/derived.js';
import { clamp01 } from '../../../src/utils/math.js';
import type { ExplosionEvent } from '../../../src/types/index.js';
import { SeededRng } from '../../../src/utils/rng.js';

describe('derived helpers', () => {
  describe('clamp01', () => {
    it('should clamp values between 0 and 1', () => {
      expect(clamp01(-0.5)).toBe(0);
      expect(clamp01(0)).toBe(0);
      expect(clamp01(0.5)).toBe(0.5);
      expect(clamp01(1)).toBe(1);
      expect(clamp01(1.5)).toBe(1);
    });
  });

  describe('easeOutQuad', () => {
    it('should apply quadratic ease-out curve', () => {
      expect(easeOutQuad(0)).toBe(0);
      expect(easeOutQuad(1)).toBe(1);
      expect(easeOutQuad(0.5)).toBeGreaterThan(0.5);
    });

    it('should be smooth and continuous', () => {
      const values = [0, 0.25, 0.5, 0.75, 1].map(easeOutQuad);
      for (let i = 1; i < values.length; i += 1) {
        expect(values[i]).toBeGreaterThan(values[i - 1]);
      }
    });
  });

  describe('getCachedColor', () => {
    it('should return the same Color instance for same input', () => {
      const color1 = getCachedColor('#ff0000');
      const color2 = getCachedColor('#ff0000');
      expect(color1).toBe(color2);
    });

    it('should parse color strings correctly', () => {
      const color = getCachedColor('#ff0000');
      expect(color.r).toBe(1);
      expect(color.g).toBe(0);
      expect(color.b).toBe(0);
    });
  });

  describe('randomUnitVector', () => {
    it('should generate unit vectors', () => {
      const rng = new SeededRng(42);
      for (let i = 0; i < 10; i += 1) {
        const vec = randomUnitVector(rng);
        expect(vec.length()).toBeCloseTo(1, 5);
      }
    });

    it('should be deterministic with same seed', () => {
      const rng1 = new SeededRng(42);
      const rng2 = new SeededRng(42);

      const vec1 = randomUnitVector(rng1);
      const vec2 = randomUnitVector(rng2);

      expect(vec1.x).toBeCloseTo(vec2.x, 10);
      expect(vec1.y).toBeCloseTo(vec2.y, 10);
      expect(vec1.z).toBeCloseTo(vec2.z, 10);
    });
  });

  describe('getDerived', () => {
    const createTestEvent = (): ExplosionEvent => ({
      id: 1,
      seed: 42,
      faction: 'alliance',
      hull: 'fighter',
      position: new Vector3(0, 0, 0),
      radius: 2,
      startTime: 0,
      duration: 1,
      lightDuration: 0.5,
      lightFalloff: 2,
      lightColor: '#ffffff',
      flashIntensity: 1.5,
      shockwave: { delay: 0.1, duration: 0.4, maxRadius: 3 },
      fireball: { delay: 0.05, duration: 0.6 },
      debris: { count: 10, speed: [1, 3] },
      particles: { sparks: 20, plasma: 15, smoke: 18 },
      palette: {
        flash: '#ffaa55',
        shockwave: '#ff8844',
        fireballHot: '#ff6633',
        smoke: '#444444',
      },
      elapsed: 0,
      lightElapsed: 0,
    });

    it('should generate derived data for an explosion event', () => {
      const event = createTestEvent();
      const derived = getDerived(event);

      expect(derived.debris).toBeDefined();
      expect(derived.sparks).toBeDefined();
      expect(derived.plasma).toBeDefined();
      expect(derived.smoke).toBeDefined();
      expect(derived.flicker).toBeGreaterThan(0);
    });

    it('should respect particle count limits', () => {
      const event = createTestEvent();
      const derived = getDerived(event);

      expect(derived.debris.length).toBe(event.debris.count);
      expect(derived.sparks.length).toBe(event.particles.sparks);
      expect(derived.plasma.length).toBe(event.particles.plasma);
      expect(derived.smoke.length).toBe(event.particles.smoke);
    });

    it('should cache derived data for same event', () => {
      const event = createTestEvent();
      const derived1 = getDerived(event);
      const derived2 = getDerived(event);

      expect(derived1).toBe(derived2);
    });

    it('should regenerate derived data when event properties change', () => {
      const event = createTestEvent();
      const derived1 = getDerived(event);

      event.seed = 99;
      const derived2 = getDerived(event);

      expect(derived1).not.toBe(derived2);
    });

    it('should be deterministic for same seed', () => {
      const event1 = createTestEvent();
      const event2 = createTestEvent();

      const derived1 = getDerived(event1);
      const derived2 = getDerived(event2);

      expect(derived1.debris[0].direction.x).toBeCloseTo(derived2.debris[0].direction.x, 10);
      expect(derived1.debris[0].speed).toBeCloseTo(derived2.debris[0].speed, 10);
    });

    it('should generate valid particle properties', () => {
      const event = createTestEvent();
      const derived = getDerived(event);

      for (const particle of derived.debris) {
        expect(particle.direction.length()).toBeCloseTo(1, 5);
        expect(particle.speed).toBeGreaterThan(0);
        expect(particle.lifetime).toBeGreaterThan(0);
        expect(particle.axis.length()).toBeCloseTo(1, 5);
      }

      for (const wisp of derived.smoke) {
        expect(wisp.lifetime).toBeGreaterThan(0);
        expect(wisp.scale).toBeGreaterThan(0);
      }
    });
  });
});
