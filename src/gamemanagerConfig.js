/**
 * Gamemanager visual/config defaults
 *
 * This module exports named constant objects used by `src/gamemanager.js` as
 * default tuning for visual effects and starfield behavior. The exports are:
 *
 *  - SHIELD: defaults for shield-hit particles and TTL
 *  - HEALTH: defaults for health-hit particles and TTL
 *  - EXPLOSION: defaults controlling explosion particle bursts (count, size, speed)
 *  - STARS: starfield rendering/twinkle defaults
 *
 * These are intentionally provided as plain objects so consumers can import
 * specific values or call `setManagerConfig()` at runtime to override fields.
 */
// Exported as named constants to match existing config modules (behaviorConfig.js, progressionConfig.js)
export const SHIELD = {
  // ttl: how long (seconds) the shield flash persists in the flash list
  ttl: 0.4,
  // particleCount: number of particles spawned for a shield hit
  particleCount: 6,
  // particleTTL: lifetime in seconds for each spawned particle
  particleTTL: 0.35,
  // particleColor: CSS color string used for spawned particles
  particleColor: 'rgba(160,200,255,0.9)',
  // particleSize: nominal particle size in pixels
  particleSize: 2
};

export const HEALTH = {
  // ttl: how long (seconds) the health hit flash persists in the flash list
  ttl: 0.75,
  // particleCount: number of particles spawned for a health hit
  particleCount: 8,
  // particleTTL: lifetime in seconds for each spawned particle
  particleTTL: 0.6,
  // particleColor: CSS color string used for spawned particles
  particleColor: 'rgba(255,120,80,0.95)',
  // particleSize: nominal particle size in pixels
  particleSize: 2
};

export const EXPLOSION = {
  // particleCount: number of particles to spawn for an explosion
  particleCount: 12,
  // particleTTL: lifetime in seconds for explosion particles
  particleTTL: 0.6,
  // particleColor: CSS color string for explosion particles
  particleColor: 'rgba(255,200,100,0.95)',
  // particleSize: nominal particle size in pixels
  particleSize: 3,
  // minSpeed/maxSpeed: spawn velocity range in pixels/second for explosion particles
  minSpeed: 30,
  maxSpeed: 120
};

export const STARS = {
  // twinkle: enable per-star alpha twinkle (true = animate alpha over time)
  twinkle: false,
  // redrawInterval: when twinkle is enabled, how often (seconds) to regenerate star canvas
  redrawInterval: 0.35
};

export default { SHIELD, HEALTH, EXPLOSION, STARS };
