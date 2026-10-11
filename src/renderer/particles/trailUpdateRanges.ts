import type { ParticleTrailResources } from './trailResources.js';

type TrailAttribute =
  ParticleTrailResources['attributes'][keyof ParticleTrailResources['attributes']];

/**
 * Marks the GPU update range(s) for a trail attribute, handling ring-buffer
 * wraparound when a frame's spawns cross the buffer end.
 *
 * @param {number} itemSize - Components per element (3 for vec3, 1 for scalar).
 * @param {number} startParticleIndex - First particle index written this frame.
 * @param {number} spawnedParticleCount - Number of particles spawned this frame.
 * @param {number} maxParticles - Ring-buffer capacity.
 * @param {TrailAttribute} attribute - The attribute to mark.
 */
export function markAttributeUpdateRange(
  itemSize: number,
  startParticleIndex: number,
  spawnedParticleCount: number,
  maxParticles: number,
  attribute: TrailAttribute,
): void {
  attribute.clearUpdateRanges();

  if (spawnedParticleCount <= 0) {
    return;
  }

  if (spawnedParticleCount >= maxParticles) {
    attribute.addUpdateRange(0, maxParticles * itemSize);
    attribute.needsUpdate = true;
    return;
  }

  const firstRangeCount = Math.min(spawnedParticleCount, maxParticles - startParticleIndex);
  attribute.addUpdateRange(startParticleIndex * itemSize, firstRangeCount * itemSize);

  const overflowCount = spawnedParticleCount - firstRangeCount;
  if (overflowCount > 0) {
    attribute.addUpdateRange(0, overflowCount * itemSize);
  }

  attribute.needsUpdate = true;
}
