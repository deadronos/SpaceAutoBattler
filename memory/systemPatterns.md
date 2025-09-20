# System Patterns — SpaceAutoBattler

High-level architecture patterns used across the repo:

- Game state canonicalization: A single `GameState` object represents all runtime state; modules read and update this state rather than using module-level state.

- Clear separation of concerns:
  - Core logic (`src/core`) — pure game rules, AI, entity management.
  - Simulation (`src/simWorker.ts`) — deterministic physics (Rapier3D) running in a Web Worker.
  - Renderer (`src/renderer`) — Three.js visuals and postprocessing on the main thread.

- Asset pooling: use `GameState.assetPool` for shared geometries, materials, and textures; prefer reuse over allocation.

- Deterministic RNG: use seeded RNG helpers (`src/utils/rng.ts`) for any simulation-influencing randomness.

- Message-based sync: main thread and worker communicate via small, serializable messages; never pass Three.js objects across threads.

Guidance:

- Add high-level integration tests that assert simulation determinism across runs.
- Keep config values in `src/config` rather than scattering constants through code.

Generated: 2025-09-15
