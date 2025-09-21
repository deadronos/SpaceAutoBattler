# src/game/state.ts

Path: src/game/state.ts
Last-Reviewed: 2025-09-21

Purpose: Canonical GameState factory and runtime state management helpers. Creates and disposes `GameState` and provides helper functions for spawning/destroying entities.

Key exports/symbols:
- createGameState
- disposeGameState
- GameState type (canonical runtime state)

Notes:
- All runtime state must live on `GameState`. Do not introduce module-level mutable state.
- Deterministic RNG usage expected via `src/utils/rng.ts`.
