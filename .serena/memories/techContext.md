## Tech Context

Last-Reviewed: 2025-09-15

Technologies used:

- TypeScript, Three.js for rendering
- Rapier (WASM) for physics in a Worker
- Vitest for unit tests
- Webpack for builds

Constraints:

- Keep deterministic RNG usage via `src/utils/rng.ts`.
- Avoid module-level mutable state; use `GameState`.

Notes from this session (2025-09-15):

- Reviewed and annotated as part of the memory sweep.
