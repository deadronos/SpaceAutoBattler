let _seeded = false;
let _seed = 123456789;

export function srand(s) {
  _seeded = true;
  _seed = s >>> 0;
}

export function unseed() {
  _seeded = false;
}

export function srandom() {
  if (!_seeded) return Math.random();
  // 32-bit LCG from Numerical Recipes
  _seed = (1664525 * _seed + 1013904223) >>> 0;
  return _seed / 4294967296;
}

export function srange(a = 0, b = 1) {
  return a + (b - a) * srandom();
}

export function srangeInt(a, b) {
  // inclusive
  return Math.floor(srange(a, b + 1));
}
