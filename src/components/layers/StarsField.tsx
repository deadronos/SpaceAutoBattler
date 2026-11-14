import type React from 'react';
import { SeededRng } from '../../utils/rng.js';
import { WORLD_SIZE } from '../../game/config.js';

export const STAR_FIELD_COUNT = 3500;
export const STAR_FIELD_SEED = 2024;
/** Inner shell radius well outside the playable arena and planetary foreground. */
export const STAR_FIELD_MIN_RADIUS = WORLD_SIZE * 1.25;
/** Outer shell radius inside the star sphere (30000) and skysphere (45000). */
export const STAR_FIELD_MAX_RADIUS = WORLD_SIZE * 3;

/**
 * Generates deterministic 3D star positions distributed isotropically across a
 * spherical shell outside the inner arena.
 *
 * @param {number} [count=STAR_FIELD_COUNT] - Number of stars to generate.
 * @param {number} [seed=STAR_FIELD_SEED] - Seed for the deterministic RNG.
 * @param {number} [minRadius=STAR_FIELD_MIN_RADIUS] - Minimum radial distance from origin.
 * @param {number} [maxRadius=STAR_FIELD_MAX_RADIUS] - Maximum radial distance from origin.
 * @returns {Float32Array} Packed xyz coordinates (`count * 3` floats).
 */
export function generateStarPositions(
  count: number = STAR_FIELD_COUNT,
  seed: number = STAR_FIELD_SEED,
  minRadius: number = STAR_FIELD_MIN_RADIUS,
  maxRadius: number = STAR_FIELD_MAX_RADIUS,
): Float32Array {
  const positions = new Float32Array(count * 3);
  const rng = new SeededRng(seed);
  const minR3 = minRadius * minRadius * minRadius;
  const maxR3 = maxRadius * maxRadius * maxRadius;

  for (let i = 0; i < count; i += 1) {
    const cosTheta = rng.next() * 2 - 1;
    const sinTheta = Math.sqrt(Math.max(0, 1 - cosTheta * cosTheta));
    const phi = rng.next() * Math.PI * 2;
    const radius = Math.cbrt(minR3 + rng.next() * (maxR3 - minR3));

    const offset = i * 3;
    positions[offset] = radius * sinTheta * Math.cos(phi);
    positions[offset + 1] = radius * cosTheta;
    positions[offset + 2] = radius * sinTheta * Math.sin(phi);
  }

  return positions;
}

const STAR_POSITIONS = generateStarPositions();

/**
 * Renders a static star field background.
 * Uses a points mesh for performance.
 *
 * @returns {React.ReactElement} The star field component.
 */
export function StarsField(): React.ReactElement {
  return (
    <group>
      <points position={[0, 0, 0]}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[STAR_POSITIONS, 3]} />
        </bufferGeometry>
        <pointsMaterial
          color="#ffffff"
          size={1.5}
          sizeAttenuation={false}
          depthWrite={false}
          fog={false}
        />
      </points>
    </group>
  );
}
