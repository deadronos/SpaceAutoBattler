// src/rng.ts - Seeded RNG utilities (ported from rng.js)
let _state: number | null = null;

export function srand(seed?: number) {
  // Mirror original behavior: accept 32-bit seed and coerce to non-zero; if undefined -> leave null
  if (typeof seed === 'number') {
    _state = (seed >>> 0) || 1;
  } else {
    _state = null;
  }
}

function _next(): number {
  // xorshift/LCG style used in original; keep same constants
  if (_state === null) _state = 1;
  // Math.imul for 32-bit multiply, then add, then >>> 0 to ensure uint32
  _state = (Math.imul(1664525, _state) + 1013904223) >>> 0;
  return _state;
}

export function srandom(): number {
  if (_state === null) return Math.random();
  // produce [0,1)
  const v = _next();
  return v / 4294967295;
}

export function srange(min: number, max: number): number {
  return min + srandom() * (max - min);
}

export function srangeInt(min: number, max: number): number {
  // inclusive min, exclusive max to match common patterns
  return Math.floor(srange(min, max));
}

export default { srand, srandom, srange, srangeInt };
