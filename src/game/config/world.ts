import { clamp } from '../../utils/math.js';

// Centralized world configuration.
// A cubic world sized WORLD_SIZE^3 centered at the origin.
// Keep gameplay deterministic: no randomness here.

/**
 * World edge length in units. The world is a cube centered at the origin.
 */
export const WORLD_SIZE = 8000; // length of one edge of the world cube

/**
 * Distance from the origin to any face of the world cube.
 */
export const WORLD_HALF = WORLD_SIZE / 2; // half-extent from origin to any face

/**
 * Default camera settings.
 */
export const CAMERA_DEFAULTS = {
  position: [0, 600, 1600] as const,
  fov: 55,
  near: 0.1,
  far: WORLD_SIZE * 10,
};

/**
 * Default fog configuration.
 */
export const FOG_DEFAULTS: readonly [string, number, number] = [
  '#02030b',
  WORLD_SIZE * 0.8,
  WORLD_SIZE * 10,
];

/**
 * Margin to keep ships away from the absolute world boundary.
 */
export const WORLD_BOUNDS_MARGIN = 2; // small margin to stay slightly within the cube

/**
 * Clamps a position vector to strictly stay within the world bounds.
 * Modifies the vector in-place.
 *
 * @param {{ x: number; y: number; z: number }} v - The position vector to clamp.
 */
export function clampToWorld(v: { x: number; y: number; z: number }): void {
  const min = -WORLD_HALF + WORLD_BOUNDS_MARGIN;
  const max = WORLD_HALF - WORLD_BOUNDS_MARGIN;
  v.x = clamp(v.x, min, max);
  v.y = clamp(v.y, min, max);
  v.z = clamp(v.z, min, max);
}
