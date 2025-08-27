// src/rng.ts - Seeded RNG utilities (ported from rng.js)
let _seed = 1;
export function srand(seed = 1) {
    // store as 32-bit unsigned
    _seed = seed >>> 0;
}
// mulberry32 PRNG
function mulberry32(a) {
    return function () {
        let t = (a += 0x6D2B79F5) >>> 0;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
export function srandom() {
    const f = mulberry32(_seed);
    // advance seed deterministically
    _seed = (_seed + 0x9E3779B1) >>> 0;
    return f();
}
export function srange(min, max) {
    return min + (max - min) * srandom();
}
export function srangeInt(min, max) {
    // exclusive upper bound to match expectations
    return Math.floor(srange(min, max));
}
export default { srand, srandom, srange, srangeInt };
