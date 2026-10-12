import type { InstancedLayerManager } from '../../layers/types.js';
import type { EffectUpdateResult } from './types.js';
import { EMPTY_EFFECT_RESULT } from './types.js';
import { EXPLOSION_PARTICLE_KEY_STRIDE } from '../constants.js';

/**
 * Callback function for updating a single particle instance.
 * Returns true to continue processing particles, false to break the loop.
 */
export type ParticleUpdateCallback<T> = (
  particle: T,
  index: number,
  particleTime: number,
) => boolean;

/**
 * Helper to reduce duplication in particle effect updaters.
 * Handles the common loop structure for particle arrays with delay, lifetime checks,
 * allocation, and saturation tracking.
 *
 * Each particle effect has its own manager, so keys only need to be unique within
 * this effect. The numeric key is derived from the event id and particle index
 * without constructing any strings.
 *
 * @param particles - Array of particle data (debris, plasma, sparks, smoke, etc.)
 * @param effectTime - Time relative to effect start (after delay is already subtracted)
 * @param manager - Instance manager for allocation
 * @param eventId - Numeric per-event identity; combined with the particle index for the key
 * @param getLifetime - Function to get lifetime from a particle
 * @param updateCallback - Callback to update a single particle instance
 * @returns Result with count and saturation status
 */
export function processParticleArray<T>(
  particles: readonly T[],
  effectTime: number,
  manager: InstancedLayerManager<number>,
  eventId: number,
  getLifetime: (particle: T) => number,
  updateCallback: ParticleUpdateCallback<T>,
): EffectUpdateResult {
  if (effectTime < 0) return EMPTY_EFFECT_RESULT;

  let count = 0;
  let saturated = false;

  for (let i = 0; i < particles.length; i++) {
    const particle = particles[i];
    if (!particle) continue;
    const lifetime = getLifetime(particle);

    // Skip expired particles
    if (effectTime > lifetime) {
      continue;
    }

    // Allocate instance
    const key = eventId * EXPLOSION_PARTICLE_KEY_STRIDE + i;
    const idx = manager.allocate(key);
    if (idx == null) {
      saturated = true;
      break;
    }

    // Update particle (callback should set matrix and color)
    const shouldContinue = updateCallback(particle, idx, effectTime);
    if (!shouldContinue) {
      break;
    }

    count += 1;
  }

  return { count, saturated };
}
