// Centralized world configuration
// A cubic world sized WORLD_SIZE^3 centered at the origin.
// Keep gameplay deterministic: no randomness here.

export const WORLD_SIZE = 4000; // length of one edge of the world cube
export const WORLD_HALF = WORLD_SIZE / 2; // half-extent from origin to any face

// Camera defaults tuned for the larger world scale; consumers may override.
export const CAMERA_DEFAULTS = {
  position: [0, 600, 1600] as const,
  fov: 55,
  near: 0.1,
  far: WORLD_SIZE * 5
};

// Fog tuned for deep space look at larger scales
export const FOG_DEFAULTS: readonly [string, number, number] = ['#02030b', WORLD_SIZE * 0.4, WORLD_SIZE * 1.2];

// AI and movement configuration
export const WORLD_BOUNDS_MARGIN = 2; // small margin to stay slightly within the cube

// Helper to clamp a position vector to the world cube bounds (inclusive)
export function clampToWorld(v: { x: number; y: number; z: number }): void {
  const min = -WORLD_HALF + WORLD_BOUNDS_MARGIN;
  const max = WORLD_HALF - WORLD_BOUNDS_MARGIN;
  v.x = Math.min(Math.max(v.x, min), max);
  v.y = Math.min(Math.max(v.y, min), max);
  v.z = Math.min(Math.max(v.z, min), max);
}
