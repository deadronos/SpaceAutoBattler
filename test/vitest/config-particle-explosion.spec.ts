import { describe, test, expect } from 'vitest';
import { RendererConfig } from '../../src/config/rendererConfig.js';
import type { ParticleExplosionOptions } from '../../src/types/index.js';

/**
 * Configuration validation tests for particle explosion parameters
 * Tests for GH-003: configurable parameters & defaults
 */
describe('Particle Explosion Configuration', () => {
  describe('config structure validation', () => {
    test('should have all required explosion config keys', () => {
      const explosionConfig = RendererConfig.particles.explosion;
      
      // Core feature toggle
      expect(explosionConfig).toHaveProperty('enabled');
      expect(typeof explosionConfig.enabled).toBe('boolean');
      
      // Particle count parameters
      expect(explosionConfig).toHaveProperty('countPerRadius');
      expect(typeof explosionConfig.countPerRadius).toBe('number');
      expect(explosionConfig).toHaveProperty('minCount');
      expect(typeof explosionConfig.minCount).toBe('number');
      expect(explosionConfig).toHaveProperty('maxCount');
      expect(typeof explosionConfig.maxCount).toBe('number');
      
      // Lifetime parameter
      expect(explosionConfig).toHaveProperty('lifetime');
      expect(typeof explosionConfig.lifetime).toBe('number');
      
      // Size parameters
      expect(explosionConfig).toHaveProperty('size');
      expect(explosionConfig.size).toHaveProperty('min');
      expect(explosionConfig.size).toHaveProperty('max');
      expect(typeof explosionConfig.size.min).toBe('number');
      expect(typeof explosionConfig.size.max).toBe('number');
      
      // Velocity parameters
      expect(explosionConfig).toHaveProperty('velocity');
      expect(explosionConfig.velocity).toHaveProperty('radial');
      expect(explosionConfig.velocity.radial).toHaveProperty('min');
      expect(explosionConfig.velocity.radial).toHaveProperty('max');
      expect(explosionConfig.velocity).toHaveProperty('randomSpread');
      expect(typeof explosionConfig.velocity.radial.min).toBe('number');
      expect(typeof explosionConfig.velocity.radial.max).toBe('number');
      expect(typeof explosionConfig.velocity.randomSpread).toBe('number');
      
      // Colors array
      expect(explosionConfig).toHaveProperty('colors');
      expect(Array.isArray(explosionConfig.colors)).toBe(true);
      expect(explosionConfig.colors.length).toBeGreaterThan(0);
      
      // Pooling parameters
      expect(explosionConfig).toHaveProperty('pooling');
      expect(explosionConfig.pooling).toHaveProperty('initial');
      expect(explosionConfig.pooling).toHaveProperty('growTo');
      expect(typeof explosionConfig.pooling.initial).toBe('number');
      expect(typeof explosionConfig.pooling.growTo).toBe('number');
      
      // LOD toggles
      expect(explosionConfig).toHaveProperty('lod');
      expect(explosionConfig.lod).toHaveProperty('enabled');
      expect(explosionConfig.lod).toHaveProperty('distanceThresholds');
      expect(explosionConfig.lod).toHaveProperty('particleScaling');
      expect(typeof explosionConfig.lod.enabled).toBe('boolean');
      expect(Array.isArray(explosionConfig.lod.distanceThresholds)).toBe(true);
      expect(Array.isArray(explosionConfig.lod.particleScaling)).toBe(true);
    });
  });

  describe('default value validation', () => {
    test('should have reasonable default values within expected ranges', () => {
      const explosionConfig = RendererConfig.particles.explosion;
      
      // Count parameters should be positive and sensible
      expect(explosionConfig.countPerRadius).toBeGreaterThan(0);
      expect(explosionConfig.countPerRadius).toBeLessThan(100); // reasonable max
      expect(explosionConfig.minCount).toBeGreaterThan(0);
      expect(explosionConfig.minCount).toBeLessThan(explosionConfig.maxCount);
      expect(explosionConfig.maxCount).toBeGreaterThan(explosionConfig.minCount);
      expect(explosionConfig.maxCount).toBeLessThan(1000); // reasonable max
      
      // Lifetime should be positive and reasonable
      expect(explosionConfig.lifetime).toBeGreaterThan(0);
      expect(explosionConfig.lifetime).toBeLessThan(10); // reasonable max
      
      // Size values should be positive and properly ordered
      expect(explosionConfig.size.min).toBeGreaterThan(0);
      expect(explosionConfig.size.max).toBeGreaterThan(explosionConfig.size.min);
      expect(explosionConfig.size.max).toBeLessThan(10); // reasonable max
      
      // Velocity values should be positive and properly ordered
      expect(explosionConfig.velocity.radial.min).toBeGreaterThan(0);
      expect(explosionConfig.velocity.radial.max).toBeGreaterThan(explosionConfig.velocity.radial.min);
      expect(explosionConfig.velocity.randomSpread).toBeGreaterThanOrEqual(0);
      expect(explosionConfig.velocity.randomSpread).toBeLessThanOrEqual(2); // reasonable max
      
      // Colors should be valid hex colors
      explosionConfig.colors.forEach(color => {
        expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
      });
      
      // Pooling values should be positive and properly ordered
      expect(explosionConfig.pooling.initial).toBeGreaterThan(0);
      expect(explosionConfig.pooling.growTo).toBeGreaterThanOrEqual(explosionConfig.pooling.initial);
      expect(explosionConfig.pooling.growTo).toBeLessThan(10000); // reasonable max
    });
  });

  describe('LOD configuration validation', () => {
    test('should have properly structured LOD configuration', () => {
      const lodConfig = RendererConfig.particles.explosion.lod;
      
      // LOD arrays should have matching lengths
      expect(lodConfig.distanceThresholds.length).toBe(lodConfig.particleScaling.length);
      
      // Distance thresholds should be ordered ascending
      for (let i = 1; i < lodConfig.distanceThresholds.length; i++) {
        expect(lodConfig.distanceThresholds[i]).toBeGreaterThan(lodConfig.distanceThresholds[i - 1]);
      }
      
      // Distance thresholds should be positive
      lodConfig.distanceThresholds.forEach(distance => {
        expect(distance).toBeGreaterThan(0);
      });
      
      // Particle scaling values should be between 0 and 1 (inclusive)
      lodConfig.particleScaling.forEach(scale => {
        expect(scale).toBeGreaterThan(0);
        expect(scale).toBeLessThanOrEqual(1);
      });
      
      // First LOD level should typically be 1.0 (full detail)
      expect(lodConfig.particleScaling[0]).toBe(1.0);
    });
  });

  describe('ParticleExplosionOptions type validation', () => {
    test('should accept valid ParticleExplosionOptions objects', () => {
      // This test validates that the type definition allows valid configurations
      const validOptions: ParticleExplosionOptions = {
        pos: { x: 0, y: 0, z: 0 },
        radius: 5.0,
      };
      
      expect(validOptions.pos).toBeDefined();
      expect(validOptions.radius).toBeDefined();
      expect(typeof validOptions.pos.x).toBe('number');
      expect(typeof validOptions.pos.y).toBe('number');
      expect(typeof validOptions.pos.z).toBe('number');
      expect(typeof validOptions.radius).toBe('number');
    });

    test('should accept optional ParticleExplosionOptions parameters', () => {
      const optionsWithOptionals: ParticleExplosionOptions = {
        pos: { x: 1, y: 2, z: 3 },
        radius: 10,
        seed: 12345,
        colorOverride: ['#ff0000', '#00ff00', '#0000ff'],
        count: 50,
        lifetime: 2.5,
        entityId: 999,
      };
      
      expect(optionsWithOptionals.seed).toBeDefined();
      expect(optionsWithOptionals.colorOverride).toBeDefined();
      expect(optionsWithOptionals.count).toBeDefined();
      expect(optionsWithOptionals.lifetime).toBeDefined();
      expect(optionsWithOptionals.entityId).toBeDefined();
      
      expect(Array.isArray(optionsWithOptionals.colorOverride)).toBe(true);
      expect(typeof optionsWithOptionals.seed).toBe('number');
      expect(typeof optionsWithOptionals.count).toBe('number');
      expect(typeof optionsWithOptionals.lifetime).toBe('number');
      expect(typeof optionsWithOptionals.entityId).toBe('number');
    });
  });

  describe('configuration consistency validation', () => {
    test('should have consistent configuration values', () => {
      const config = RendererConfig.particles.explosion;
      
      // Min/max relationships should be consistent
      expect(config.minCount).toBeLessThanOrEqual(config.maxCount);
      expect(config.size.min).toBeLessThan(config.size.max);
      expect(config.velocity.radial.min).toBeLessThan(config.velocity.radial.max);
      expect(config.pooling.initial).toBeLessThanOrEqual(config.pooling.growTo);
      
      // Velocity spread should be reasonable
      expect(config.velocity.randomSpread).toBeGreaterThanOrEqual(0);
      expect(config.velocity.randomSpread).toBeLessThanOrEqual(2);
      
      // Color array should not be empty
      expect(config.colors.length).toBeGreaterThan(0);
      
      // LOD arrays should have consistent lengths
      expect(config.lod.distanceThresholds.length).toBe(config.lod.particleScaling.length);
    });
  });
});