## Tech Context

Last-Reviewed: 2025-09-07

Technologies used:
- TypeScript, Three.js for rendering
- Rapier (WASM) for physics in a Worker
- Vitest for unit tests
- Webpack for builds

Constraints:
- Keep deterministic RNG usage via `src/utils/rng.ts`.
- Avoid module-level mutable state; use `GameState`.