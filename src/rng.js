// Minimal seeded RNG (LCG) implementing the spec in spec-design-rng.md
// Exports: srand, unseed, srandom, srange, srangeInt
let _state = null;

/** Seed the LCG with a 32-bit unsigned integer. Use srand(null) or unseed()
 * to revert to Math.random(). Passing 0 will be normalized to 1 to avoid
 * the degenerate zero-state for this LCG implementation.
 * @param {number} seed 32-bit unsigned seed
 */
export function srand(seed) {
  _state = (seed >>> 0) || 1;
}

/** Disable seeded RNG and fall back to Math.random(). */
export function unseed() { _state = null; }

/** Internal: advance LCG state and return raw 32-bit unsigned value. */
function _next() {
  // 32-bit LCG constants (Numerical Recipes / glibc style)
  // state = (a * state + c) mod 2^32
  _state = (Math.imul(1664525, _state) + 1013904223) >>> 0;
  return _state;
}

/**
 * Return a pseudo-random number in [0, 1). Uses the seeded LCG when seeded,
 * otherwise falls back to Math.random(). Deterministic when seeded.
 */
export function srandom() {
  if (_state === null) return Math.random();
  const v = _next();
  return v / 0x100000000; // [0,1)
}

/** Linear range using the seeded random generator: [a, b) */
export function srange(a = 0, b = 1) {
  const r = srandom();
  return a + r * (b - a);
}

/** Integer range inclusive [a, b] using seeded randomness. Handles inverted args. */
export function srangeInt(a, b) {
  if (a > b) {
    const t = a; a = b; b = t;
  }
  const r = Math.floor(srange(a, b + 1));
  return Math.max(a, Math.min(b, r));
}

/** True when RNG is currently seeded. */
export function isSeeded() { return _state !== null; }

export default { srand, unseed, srandom, srange, srangeInt, isSeeded };
