# Agents Guide: src/utils

- Purpose: Shared utility helpers for loaders, math, and deterministic behaviours.
- Expectations: Keep utilities pure and side-effect free; expose explicit TypeScript signatures.
- RNG: Update `rng.ts` to extend deterministic behaviour rather than introducing ad-hoc randomness.
- Reuse: If a helper couples tightly to a single feature, consider colocating it instead of expanding utils.
- Testing: Add Vitest coverage for new utilities, including seeded cases for reproducible outcomes.
