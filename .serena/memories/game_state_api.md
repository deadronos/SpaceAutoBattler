# game_state_api

Last-Reviewed: 2025-09-21

Authoritative mapping:

- Active location: `src/game/state.ts` (createGameState/disposeGameState and entity lifecycle helpers).
- Purpose: Provide the canonical `GameState` object for the simulation and test harnesses. The module handles Rapier initialization, Miniplex world creation, seeded RNG setup, and helper functions to spawn/destroy entities.

Notes:

- This memory supersedes older `src/core/*` references — prefer to consult `src/game/state.ts` directly for exact signatures.
