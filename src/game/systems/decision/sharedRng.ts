const MODULUS = 0x7fffffff;
const MULTIPLIER = 48271;

function normalizeSeed(seed: number): number {
  const normalized = (seed >>> 0) % MODULUS;
  return normalized === 0 ? 1 : normalized;
}

function stepLehmer(state: number): number {
  const next = (state * MULTIPLIER) % MODULUS;
  return next === 0 ? 1 : next;
}

/**
 * Pure, stateless deterministic hash-to-float helper.
 * Maps a numeric seed (and optional step index) to a pseudo-random float in (0, 1).
 *
 * @param {number} seed - Seed value.
 * @param {number} [step=0] - Non-negative stream offset for drawing multiple values from one seed.
 * @returns {number} Deterministic float in (0, 1).
 */
export function seededFloat(seed: number, step = 0): number {
  let state = normalizeSeed(seed);
  const steps = Number.isFinite(step) ? Math.max(0, Math.trunc(step)) + 1 : 1;
  for (let i = 0; i < steps; i += 1) {
    state = stepLehmer(state);
  }
  return state / MODULUS;
}

/**
 * Pure, stateless deterministic range helper.
 * Maps a seed and step offset to a pseudo-random float in [min, max).
 *
 * @param {number} seed - Seed value.
 * @param {number} min - Minimum bound (inclusive).
 * @param {number} max - Maximum bound (exclusive).
 * @param {number} [step=0] - Non-negative stream offset.
 * @returns {number} Deterministic float in [min, max).
 */
export function seededRange(seed: number, min: number, max: number, step = 0): number {
  return min + (max - min) * seededFloat(seed, step);
}

/**
 * Pure, stateless deterministic Box-Muller normal sample helper.
 * Maps a seed to a normally distributed value around `mean` with `stdDev`.
 *
 * @param {number} seed - Seed value.
 * @param {number} [mean=0] - Distribution mean.
 * @param {number} [stdDev=1] - Distribution standard deviation.
 * @returns {number} Deterministic normal sample.
 */
export function seededNormal(seed: number, mean = 0, stdDev = 1): number {
  const s1 = stepLehmer(normalizeSeed(seed));
  const s2 = stepLehmer(s1);
  const u = s1 / MODULUS;
  const v = s2 / MODULUS;
  const mag = Math.sqrt(-2.0 * Math.log(u));
  const z0 = mag * Math.cos(2 * Math.PI * v);
  return mean + z0 * stdDev;
}
