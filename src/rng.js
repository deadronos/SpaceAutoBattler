// Minimal seeded RNG (LCG) implementing the spec in spec-design-rng.md
// Exports: srand, unseed, srandom, srange, srangeInt
let _state = null;

export function srand(seed) {
  _state = (seed >>> 0) || 1;
}

export function unseed() {
  _state = null;
}

function _next() {
  // 32-bit LCG constants (Numerical Recipes / glibc style)
  // state = (a * state + c) mod 2^32
  _state = (Math.imul(1664525, _state) + 1013904223) >>> 0;
  return _state;
}

export function srandom() {
  if (_state === null) return Math.random();
  const v = _next();
  const result = v / 0x100000000; // [0,1)
  return result;
}

export function srange(a = 0, b = 1) {
  const r = srandom();
  return a + r * (b - a);
}

export function srangeInt(a, b) {
  if (a > b) {
    const t = a; a = b; b = t;
  }
  const r = Math.floor(srange(a, b + 1));
  return Math.max(a, Math.min(b, r));
}

export default { srand, unseed, srandom, srange, srangeInt };
