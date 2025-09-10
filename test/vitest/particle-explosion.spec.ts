import { describe, test, expect, beforeEach } from 'vitest';
import type { GameState } from '../../src/types/index.js';
import { createInitialState } from '../../src/core/gameState.js';
import {
  addParticleExplosion,
  ParticleSystem,
  type ParticleExplosionOptions,
} from '../../src/renderer/particleSystem.js';
import { RendererConfig } from '../../src/config/rendererConfig.js';

/**
 * Particle Explosion API Tests
 * Tests for GH-001: add particle explosion API
 */
describe('Particle Explosion API', () => {
  let gameState: GameState;
  let particleSystem: ParticleSystem;

  beforeEach(() => {
    gameState = createInitialState('particle-test-seed');
    gameState.time = 1.0; // Set a fixed time for deterministic testing
    particleSystem = new ParticleSystem(gameState, 64); // Small pool for testing
  });

  describe('addParticleExplosion function', () => {
    test('should exist and be callable', () => {
      expect(addParticleExplosion).toBeDefined();
      expect(typeof addParticleExplosion).toBe('function');
    });

    test('should create particles when called with valid options', () => {
      const opts: ParticleExplosionOptions = {
        pos: { x: 0, y: 0, z: 0 },
        radius: 5,
      };

      const statsBefore = particleSystem.stats();
      expect(statsBefore.activeCount).toBe(0);

      particleSystem.addParticleExplosion(opts);

      const statsAfter = particleSystem.stats();
      expect(statsAfter.activeCount).toBeGreaterThan(0);
      expect(statsAfter.activeCount).toBeGreaterThanOrEqual(
        RendererConfig.particles.explosion.minCount,
      );
    });

    test('should respect particle count limits from config', () => {
      const opts: ParticleExplosionOptions = {
        pos: { x: 0, y: 0, z: 0 },
        radius: 100, // Large radius to test maxCount limiting
      };

      particleSystem.addParticleExplosion(opts);

      const stats = particleSystem.stats();
      expect(stats.activeCount).toBeLessThanOrEqual(RendererConfig.particles.explosion.maxCount);
      expect(stats.activeCount).toBeGreaterThanOrEqual(RendererConfig.particles.explosion.minCount);
    });

    test('should use custom particle count when provided', () => {
      const customCount = 15; // Above minCount of 8
      const opts: ParticleExplosionOptions = {
        pos: { x: 0, y: 0, z: 0 },
        radius: 5,
        count: customCount,
      };

      particleSystem.addParticleExplosion(opts);

      const stats = particleSystem.stats();
      expect(stats.activeCount).toBe(customCount);
    });

    test('should be deterministic with same seed', () => {
      const opts: ParticleExplosionOptions = {
        pos: { x: 10, y: 20, z: 30 },
        radius: 5,
        seed: 12345,
      };

      // Create first explosion
      const system1 = new ParticleSystem(gameState, 64);
      system1.addParticleExplosion(opts);

      // Create second explosion with same parameters
      const system2 = new ParticleSystem(gameState, 64);
      system2.addParticleExplosion(opts);

      // Both should have same number of active particles
      expect(system1.stats().activeCount).toBe(system2.stats().activeCount);
    });

    test('should not create particles when disabled in config', () => {
      // Temporarily disable particle explosions
      const originalEnabled = RendererConfig.particles.explosion.enabled;
      RendererConfig.particles.explosion.enabled = false;

      const opts: ParticleExplosionOptions = {
        pos: { x: 0, y: 0, z: 0 },
        radius: 5,
      };

      particleSystem.addParticleExplosion(opts);

      const stats = particleSystem.stats();
      expect(stats.activeCount).toBe(0);

      // Restore original setting
      RendererConfig.particles.explosion.enabled = originalEnabled;
    });

    test('should use custom lifetime when provided', () => {
      const customLifetime = 2.5;
      const opts: ParticleExplosionOptions = {
        pos: { x: 0, y: 0, z: 0 },
        radius: 5,
        count: 1, // Single particle for easier testing
        lifetime: customLifetime,
      };

      particleSystem.addParticleExplosion(opts);

      // Access the pool directly to check particle properties
      // This is a bit of a white-box test but necessary to verify internals
      const activeParticle = particleSystem['pool'].find((p) => p.active);
      expect(activeParticle).toBeDefined();
      expect(activeParticle!.lifetime).toBe(customLifetime);
    });
  });

  describe('particle lifecycle', () => {
    test('should recycle particles after lifetime expires', () => {
      const shortLifetime = 0.1; // Very short lifetime
      const opts: ParticleExplosionOptions = {
        pos: { x: 0, y: 0, z: 0 },
        radius: 5,
        count: 5, // This will be clamped to minCount (8)
        lifetime: shortLifetime,
      };

      particleSystem.addParticleExplosion(opts);

      // Should have active particles immediately (will be minCount=8 since count=5 < minCount)
      let stats = particleSystem.stats();
      expect(stats.activeCount).toBe(8); // minCount from config

      // Update for more than the lifetime
      const deltaTime = shortLifetime + 0.01;
      particleSystem.update(deltaTime);

      // All particles should now be recycled
      stats = particleSystem.stats();
      expect(stats.activeCount).toBe(0);
      expect(stats.freeCount).toBe(stats.poolSize); // All particles should be free
    });

    test('should update particle positions over time', () => {
      const opts: ParticleExplosionOptions = {
        pos: { x: 0, y: 0, z: 0 },
        radius: 1,
        count: 1,
        lifetime: 10, // Long lifetime
      };

      particleSystem.addParticleExplosion(opts);

      // Get initial particle position
      const particle = particleSystem['pool'].find((p) => p.active);
      expect(particle).toBeDefined();

      const initialPos = { ...particle!.pos };
      const deltaTime = 0.1;

      // Update once
      particleSystem.update(deltaTime);

      // Position should have changed due to velocity
      expect(particle!.pos.x).not.toBe(initialPos.x);
      expect(particle!.age).toBe(deltaTime);
    });
  });

  describe('exported function integration', () => {
    test('should work with standalone exported function', () => {
      const opts: ParticleExplosionOptions = {
        pos: { x: 5, y: 10, z: 15 },
        radius: 8,
      };

      // This should not throw and should create particles
      expect(() => addParticleExplosion(gameState, opts)).not.toThrow();
    });
  });
});
