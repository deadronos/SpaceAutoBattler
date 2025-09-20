# core/gameState

Last-Reviewed: 2025-09-21

**Memory name:** core-gameState (authoritative)

Summary:

- Location: `src/game/state.ts` (note: previously `src/core/gameState.ts` in older versions of the repo)
- Purpose: Canonical GameState factory and lifecycle helpers used by the simulation and by tests. The module provides deterministic seeded RNG initialization, Rapier physics world setup, Miniplex world for entities, and helper APIs for entity lifecycle.

Primary exports and responsibilities:

- `createGameState(opts?: { seed?: string }) : Promise<GameState>`
  - Asynchronously initializes any WASM dependencies (Rapier), constructs the `GameState` object, sets up the physics world, seeded RNG (`SeededRng` via `src/utils/rng.ts`), and returns the ready-to-use state.

- `disposeGameState(state: GameState): void`
  - Tears down worker resources and disposes physics world + any pooled renderer resources attached to the state.

- `destroyEntity(state: GameState, id: string): void`
  - Safely removes an entity and its runtime resources (physics bodies, colliders, instancer references) from the `GameState`.

- `spawnInitialFleets(state: GameState, config?): void`
  - Convenience for test harnesses and demo pages to populate the world with starter ships for both teams.

Key runtime patterns and notes:

- All runtime state is stored on the `GameState` object (per repo convention). Avoid module-level runtime state.
- Determinism is provided via `SeededRng` located at `src/utils/rng.ts`; the simulation must use `state.rng` when deterministic randomness is required.
- `GameState` may hold an optional `assetPool` reference (renderer attaches this during bootstrap). The renderer is responsible for three.js asset caching and prototype registration.
- Where functionality changed from earlier repo versions, memory retains a short note that the old path was `src/core/gameState.ts`.

References:
- `src/game/state.ts`, `src/types/index.ts`, `src/utils/rng.ts`

Notes:
- This memory is authoritative for the canonical `GameState` responsibilities and locations. Use `read_memory` on `src-files-overview` or `threeRenderer` for renderer-specific integration points.
