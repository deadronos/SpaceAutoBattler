import { addParticleExplosion, type ParticleExplosionOptions } from '../../src/renderer/index.js';
import { createInitialState } from '../../src/core/gameState.js';
import { describe, test, expect } from 'vitest';

/**
 * Tests that the particle explosion API is properly exported from the main renderer module
 */
describe('Particle Explosion Renderer Export', () => {
  test('should export addParticleExplosion function from main renderer module', () => {
    expect(addParticleExplosion).toBeDefined();
    expect(typeof addParticleExplosion).toBe('function');
  });

  test('should be able to import ParticleExplosionOptions type', () => {
    // This test will fail to compile if the type isn't properly exported
    const opts: ParticleExplosionOptions = {
      pos: { x: 0, y: 0, z: 0 },
      radius: 5,
    };
    expect(opts).toBeDefined();
  });

  test('should be able to call addParticleExplosion from renderer export', () => {
    const gameState = createInitialState('export-test');
    const opts: ParticleExplosionOptions = {
      pos: { x: 0, y: 0, z: 0 },
      radius: 5,
    };

    // Should not throw when called
    expect(() => addParticleExplosion(gameState, opts)).not.toThrow();
  });
});
