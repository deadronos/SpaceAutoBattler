// Small seeded RNG utility used by the simulation to keep gameplay deterministic
// when tests or runners call `srand(seed)`. Public API (srand, unseed,
// srandom, srange, srangeInt, assertSeeded) is preserved to avoid breaking
// callers/tests.

let _seeded = false;
let _seed = 123456789; // initial internal seed (unsigned 32-bit)

// LCG constants (Numerical Recipes style)
const LCG_A = 1664525;
const LCG_C = 1013904223;
const LCG_M = 4294967296; // 2**32

// If set, require that srand() is called before any srandom/srange usage.
// This mode is disabled by default to preserve historical behavior. It can
// be enabled via the RNG_REQUIRE_SEEDED env var (set to '1' or 'true') or
// programmatically via `setRequireSeededMode(true)`.
const _envRequire = typeof process !== 'undefined' && process && process.env && (process.env.RNG_REQUIRE_SEEDED === '1' || process.env.RNG_REQUIRE_SEEDED === 'true');
let _requireSeededMode = !!_envRequire;

/**
 * Seed the deterministic RNG. Pass a 32-bit integer seed.
 * @param {number} s
 */
export function srand(s) {
  _seeded = true;
  _seed = s >>> 0; // coerce to unsigned 32-bit
}

/**
 * Disable deterministic mode. Subsequent draws use Math.random().
 */
export function unseed() {
  _seeded = false;
}

/**
 * Return a pseudo-random number in [0, 1) using seeded LCG when seeded,
 * otherwise fall back to Math.random(). This preserves previous behavior.
 * @returns {number}
 */
export function srandom() {
  if (!_seeded) {
    if (_requireSeededMode) {
      throw new Error('RNG must be seeded with srand(seed) before use when RNG_REQUIRE_SEEDED mode is enabled');
    }
    return Math.random();
  }
  // advance LCG state and return normalized value in [0,1)
  _seed = (LCG_A * _seed + LCG_C) >>> 0;
  return _seed / LCG_M;
}

/**
 * Return a float in range [a, b). Accepts numbers; throws on invalid inputs.
 * @param {number} [a=0]
 * @param {number} [b=1]
 */
export function srange(a = 0, b = 1) {
  if (typeof a !== 'number' || typeof b !== 'number') {
    throw new TypeError('srange expects numeric a and b');
  }
  return a + (b - a) * srandom();
}

/**
 * Return an integer in the inclusive range [a, b].
 * @param {number} a
 * @param {number} b
 */
export function srangeInt(a, b) {
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    throw new TypeError('srangeInt expects finite numeric a and b');
  }
  // inclusive: floor(srange(a, b + 1)) — safe because srandom() returns < 1
  return Math.floor(srange(a, b + 1));
}

/**
 * Test helper: assert that RNG has been seeded. Throws if not.
 * Preserves original signature/behavior.
 */
export function assertSeeded(msg = 'RNG must be seeded with srand(seed) for deterministic behavior') {
  if (!_seeded) throw new Error(msg);
}

/**
 * Programmatically enable/disable strict seeded mode. When enabled, calls to
 * `srandom`/`srange` without prior `srand` will throw.
 * @param {boolean} flag
 */
export function setRequireSeededMode(flag = true) {
  _requireSeededMode = !!flag;
}

/**
 * Query whether strict seeded mode is active.
 * @returns {boolean}
 */
export function isRequireSeededMode() {
  return _requireSeededMode;
}
