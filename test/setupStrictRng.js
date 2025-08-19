// test/setupStrictRng.js
// Small Vitest setup helper to enable strict RNG mode for tests.
// When included in Vitest's `setupFiles`, this will cause the RNG module
// to throw if code attempts to draw from the RNG before calling `srand(seed)`.
import { setRequireSeededMode } from '../src/rng.js';

setRequireSeededMode(true);

// Export nothing; presence of this file is sufficient as a side-effect helper.
export default undefined;
