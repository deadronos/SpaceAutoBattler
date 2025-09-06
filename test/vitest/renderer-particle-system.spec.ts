import { describe, test, expect, beforeEach } from 'vitest';
import { ParticleSystem, type ParticleExplosionOptions } from '../../src/renderer/particleSystem.js';
import { createRNG } from '../../src/utils/rng.js';
import type { GameState } from '../../src/types/index.js';

describe('ParticleSystem - Deterministic RNG', () => {
  let mockGameState: GameState;

  beforeEach(() => {
    // Create a minimal mock GameState for testing
    mockGameState = {
      time: 1.5, // 1.5 seconds
      tick: 90,
      running: true,
      speedMultiplier: 1,
      rng: createRNG('test-global-seed'),
      nextId: 100,
      simConfig: {
        seed: 'sim-seed-123',
        simBounds: { width: 1000, height: 1000, depth: 200 },
        tickRate: 60,
        maxEntities: 1000,
        bulletLifetime: 5,
        maxSimulationSteps: 10,
        targetUpdateRate: 60,
  intentReevaluationRate: 1,
        boundaryBehavior: { ships: 'bounce', bullets: 'remove' },
        spatialGrid: { cellSize: 50 },
        useTimeBasedSeed: false
      },
      ships: [],
      shipDataVersion: 1,
      bullets: [],
      score: { red: 0, blue: 0 },
      behaviorConfig: {} as any
    };
  });

  describe('Deterministic Particle Generation', () => {
    test('should produce identical particle positions and velocities with same seed', () => {
      const particleSystem1 = new ParticleSystem(mockGameState, 64);
      const particleSystem2 = new ParticleSystem(mockGameState, 64);

      const explosionOpts: ParticleExplosionOptions = {
        pos: { x: 10, y: 20, z: 5 },
        radius: 15,
        seed: 42, // explicit seed for determinism
        count: 8
      };

      // Generate particles with first system
      particleSystem1.addParticleExplosion(explosionOpts);
      const stats1 = particleSystem1.stats();

      // Generate particles with second system
      particleSystem2.addParticleExplosion(explosionOpts);
      const stats2 = particleSystem2.stats();

      // Both should have the same number of active particles
      expect(stats1.activeCount).toBe(stats2.activeCount);
      expect(stats1.activeCount).toBe(8); // Should match the count

      // Extract particle data for comparison
      const particles1 = extractActiveParticles(particleSystem1);
      const particles2 = extractActiveParticles(particleSystem2);

      // Particles should match exactly
      expect(particles1).toHaveLength(8);
      expect(particles2).toHaveLength(8);

      // Compare positions and velocities within floating point tolerance
      const tolerance = 1e-10;
      for (let i = 0; i < particles1.length; i++) {
        const p1 = particles1[i];
        const p2 = particles2[i];

        expect(Math.abs(p1.pos.x - p2.pos.x)).toBeLessThan(tolerance);
        expect(Math.abs(p1.pos.y - p2.pos.y)).toBeLessThan(tolerance);
        expect(Math.abs(p1.pos.z - p2.pos.z)).toBeLessThan(tolerance);

        expect(Math.abs(p1.vel.x - p2.vel.x)).toBeLessThan(tolerance);
        expect(Math.abs(p1.vel.y - p2.vel.y)).toBeLessThan(tolerance);
        expect(Math.abs(p1.vel.z - p2.vel.z)).toBeLessThan(tolerance);

        // Other properties should also match
        expect(Math.abs(p1.size - p2.size)).toBeLessThan(tolerance);
        expect(p1.color).toBe(p2.color);
        expect(Math.abs(p1.lifetime - p2.lifetime)).toBeLessThan(tolerance);
      }
    });

    test('should produce different particles with different seeds', () => {
      const particleSystem1 = new ParticleSystem(mockGameState, 64);
      const particleSystem2 = new ParticleSystem(mockGameState, 64);

      const explosionOpts1: ParticleExplosionOptions = {
        pos: { x: 0, y: 0, z: 0 },
        radius: 10,
        seed: 123,
        count: 12 // higher than minCount of 8
      };

      const explosionOpts2: ParticleExplosionOptions = {
        pos: { x: 0, y: 0, z: 0 },
        radius: 10,
        seed: 456, // different seed
        count: 12 // higher than minCount of 8
      };

      particleSystem1.addParticleExplosion(explosionOpts1);
      particleSystem2.addParticleExplosion(explosionOpts2);

      const particles1 = extractActiveParticles(particleSystem1);
      const particles2 = extractActiveParticles(particleSystem2);

      expect(particles1).toHaveLength(12);
      expect(particles2).toHaveLength(12);

      // Particles should be different (with very high probability)
      let positionDifferences = 0;
      let velocityDifferences = 0;
      const tolerance = 1e-10;

      for (let i = 0; i < particles1.length; i++) {
        const p1 = particles1[i];
        const p2 = particles2[i];

        if (Math.abs(p1.pos.x - p2.pos.x) > tolerance ||
            Math.abs(p1.pos.y - p2.pos.y) > tolerance ||
            Math.abs(p1.pos.z - p2.pos.z) > tolerance) {
          positionDifferences++;
        }

        if (Math.abs(p1.vel.x - p2.vel.x) > tolerance ||
            Math.abs(p1.vel.y - p2.vel.y) > tolerance ||
            Math.abs(p1.vel.z - p2.vel.z) > tolerance) {
          velocityDifferences++;
        }
      }

      // Expect most particles to have different positions and velocities
      expect(positionDifferences).toBeGreaterThan(0);
      expect(velocityDifferences).toBeGreaterThan(0);
    });

    test('should use time-based seed derivation when no explicit seed provided', () => {
      const particleSystem1 = new ParticleSystem(mockGameState, 64);
      const particleSystem2 = new ParticleSystem(mockGameState, 64);

      const explosionOpts: ParticleExplosionOptions = {
        pos: { x: 5, y: 10, z: 0 },
        radius: 8,
        count: 10 // higher than minCount of 8
        // no explicit seed - should use time-based derivation
      };

      // Both should use the same GameState time, so should produce identical results
      particleSystem1.addParticleExplosion(explosionOpts);
      particleSystem2.addParticleExplosion(explosionOpts);

      const particles1 = extractActiveParticles(particleSystem1);
      const particles2 = extractActiveParticles(particleSystem2);

      expect(particles1).toHaveLength(10);
      expect(particles2).toHaveLength(10);

      // Should be identical due to same time value
      const tolerance = 1e-10;
      for (let i = 0; i < particles1.length; i++) {
        const p1 = particles1[i];
        const p2 = particles2[i];

        expect(Math.abs(p1.pos.x - p2.pos.x)).toBeLessThan(tolerance);
        expect(Math.abs(p1.pos.y - p2.pos.y)).toBeLessThan(tolerance);
        expect(Math.abs(p1.pos.z - p2.pos.z)).toBeLessThan(tolerance);

        expect(Math.abs(p1.vel.x - p2.vel.x)).toBeLessThan(tolerance);
        expect(Math.abs(p1.vel.y - p2.vel.y)).toBeLessThan(tolerance);
        expect(Math.abs(p1.vel.z - p2.vel.z)).toBeLessThan(tolerance);
      }
    });

    test('should handle different time values with time-based seed derivation', () => {
      const particleSystem1 = new ParticleSystem(mockGameState, 64);
      
      // Create a second GameState with different time
      const mockGameState2 = { ...mockGameState, time: 2.3 }; // different time
      const particleSystem2 = new ParticleSystem(mockGameState2, 64);

      const explosionOpts: ParticleExplosionOptions = {
        pos: { x: 0, y: 0, z: 0 },
        radius: 10,
        count: 12 // higher than minCount of 8
        // no explicit seed - should use time-based derivation
      };

      particleSystem1.addParticleExplosion(explosionOpts);
      particleSystem2.addParticleExplosion(explosionOpts);

      const particles1 = extractActiveParticles(particleSystem1);
      const particles2 = extractActiveParticles(particleSystem2);

      expect(particles1).toHaveLength(12);
      expect(particles2).toHaveLength(12);

      // Should be different due to different time values
      let differences = 0;
      const tolerance = 1e-10;

      for (let i = 0; i < particles1.length; i++) {
        const p1 = particles1[i];
        const p2 = particles2[i];

        if (Math.abs(p1.pos.x - p2.pos.x) > tolerance ||
            Math.abs(p1.pos.y - p2.pos.y) > tolerance ||
            Math.abs(p1.pos.z - p2.pos.z) > tolerance) {
          differences++;
        }
      }

      expect(differences).toBeGreaterThan(0);
    });

    test('should use XOR-based seed derivation with entityId', () => {
      const particleSystem1 = new ParticleSystem(mockGameState, 64);
      const particleSystem2 = new ParticleSystem(mockGameState, 64);

      const explosionOpts1: ParticleExplosionOptions = {
        pos: { x: 0, y: 0, z: 0 },
        radius: 10,
        count: 10,
        entityId: 123 // specific entity ID
        // no explicit seed - uses XOR derivation
      };

      const explosionOpts2: ParticleExplosionOptions = {
        pos: { x: 0, y: 0, z: 0 },
        radius: 10,
        count: 10,
        entityId: 456 // different entity ID
        // no explicit seed - uses XOR derivation
      };

      particleSystem1.addParticleExplosion(explosionOpts1);
      particleSystem2.addParticleExplosion(explosionOpts2);

      const particles1 = extractActiveParticles(particleSystem1);
      const particles2 = extractActiveParticles(particleSystem2);

      expect(particles1).toHaveLength(10);
      expect(particles2).toHaveLength(10);

      // Should produce different particles due to different entityId in XOR derivation
      let differences = 0;
      const tolerance = 1e-10;

      for (let i = 0; i < particles1.length; i++) {
        const p1 = particles1[i];
        const p2 = particles2[i];

        if (Math.abs(p1.pos.x - p2.pos.x) > tolerance ||
            Math.abs(p1.pos.y - p2.pos.y) > tolerance ||
            Math.abs(p1.pos.z - p2.pos.z) > tolerance ||
            Math.abs(p1.vel.x - p2.vel.x) > tolerance ||
            Math.abs(p1.vel.y - p2.vel.y) > tolerance ||
            Math.abs(p1.vel.z - p2.vel.z) > tolerance) {
          differences++;
        }
      }

      expect(differences).toBeGreaterThan(0);
    });

    test('should produce identical particles with same entityId and time', () => {
      const particleSystem1 = new ParticleSystem(mockGameState, 64);
      const particleSystem2 = new ParticleSystem(mockGameState, 64);

      const explosionOpts: ParticleExplosionOptions = {
        pos: { x: 5, y: 5, z: 5 },
        radius: 12,
        count: 15,
        entityId: 789 // same entity ID
        // no explicit seed - uses XOR derivation
      };

      particleSystem1.addParticleExplosion(explosionOpts);
      particleSystem2.addParticleExplosion(explosionOpts);

      const particles1 = extractActiveParticles(particleSystem1);
      const particles2 = extractActiveParticles(particleSystem2);

      expect(particles1).toHaveLength(15);
      expect(particles2).toHaveLength(15);

      // Should be identical due to same entityId and time
      const tolerance = 1e-10;
      for (let i = 0; i < particles1.length; i++) {
        const p1 = particles1[i];
        const p2 = particles2[i];

        expect(Math.abs(p1.pos.x - p2.pos.x)).toBeLessThan(tolerance);
        expect(Math.abs(p1.pos.y - p2.pos.y)).toBeLessThan(tolerance);
        expect(Math.abs(p1.pos.z - p2.pos.z)).toBeLessThan(tolerance);

        expect(Math.abs(p1.vel.x - p2.vel.x)).toBeLessThan(tolerance);
        expect(Math.abs(p1.vel.y - p2.vel.y)).toBeLessThan(tolerance);
        expect(Math.abs(p1.vel.z - p2.vel.z)).toBeLessThan(tolerance);

        expect(Math.abs(p1.size - p2.size)).toBeLessThan(tolerance);
        expect(p1.color).toBe(p2.color);
      }
    });

    test('should validate seed derivation components affect final result', () => {
      // Test that each component of XOR derivation (globalSeed, entityId, time) affects the result
      const baseTime = 1.5;
      const baseEntityId = 100;
      
      // Base case
      const mockState1 = { ...mockGameState, time: baseTime };
      const ps1 = new ParticleSystem(mockState1, 64);
      
      // Different time
      const mockState2 = { ...mockGameState, time: baseTime + 1.0 };
      const ps2 = new ParticleSystem(mockState2, 64);
      
      // Different entity ID (same time as base)
      const ps3 = new ParticleSystem(mockState1, 64);
      
      const baseOpts: ParticleExplosionOptions = {
        pos: { x: 0, y: 0, z: 0 },
        radius: 5,
        count: 10,
        entityId: baseEntityId
      };
      
      const differentEntityOpts: ParticleExplosionOptions = {
        pos: { x: 0, y: 0, z: 0 },
        radius: 5,
        count: 10,
        entityId: baseEntityId + 50 // different entity ID
      };

      ps1.addParticleExplosion(baseOpts);
      ps2.addParticleExplosion(baseOpts); // same opts, different time
      ps3.addParticleExplosion(differentEntityOpts); // different entityId

      const particles1 = extractActiveParticles(ps1);
      const particles2 = extractActiveParticles(ps2);
      const particles3 = extractActiveParticles(ps3);

      expect(particles1).toHaveLength(10);
      expect(particles2).toHaveLength(10);
      expect(particles3).toHaveLength(10);

      // All three should be different due to different XOR components
      const tolerance = 1e-10;
      
      // Verify particles1 != particles2 (different time)
      let timeBasedDifferences = 0;
      for (let i = 0; i < particles1.length; i++) {
        if (Math.abs(particles1[i].pos.x - particles2[i].pos.x) > tolerance ||
            Math.abs(particles1[i].pos.y - particles2[i].pos.y) > tolerance ||
            Math.abs(particles1[i].pos.z - particles2[i].pos.z) > tolerance) {
          timeBasedDifferences++;
        }
      }
      expect(timeBasedDifferences).toBeGreaterThan(0);

      // Verify particles1 != particles3 (different entityId)
      let entityBasedDifferences = 0;
      for (let i = 0; i < particles1.length; i++) {
        if (Math.abs(particles1[i].pos.x - particles3[i].pos.x) > tolerance ||
            Math.abs(particles1[i].pos.y - particles3[i].pos.y) > tolerance ||
            Math.abs(particles1[i].pos.z - particles3[i].pos.z) > tolerance) {
          entityBasedDifferences++;
        }
      }
      expect(entityBasedDifferences).toBeGreaterThan(0);
    });
  });
});

/**
 * Helper function to extract active particles from a ParticleSystem for testing
 * This accesses private members, so it's only for testing purposes
 */
function extractActiveParticles(particleSystem: any) {
  const particles = [];
  for (const p of particleSystem.pool) {
    if (p.active) {
      particles.push({
        pos: { x: p.pos.x, y: p.pos.y, z: p.pos.z },
        vel: { x: p.vel.x, y: p.vel.y, z: p.vel.z },
        size: p.size,
        color: p.color,
        lifetime: p.lifetime,
        age: p.age
      });
    }
  }
  return particles;
}