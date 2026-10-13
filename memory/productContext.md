# Product Context — SpaceAutoBattler

SpaceAutoBattler is a deterministic 3D auto-battler used to experiment with AI, physics-driven interactions, and rendering patterns. It aims to be both a playground for designers and a reproducible platform for deterministic simulations and visual regression tests.

Key users and stakeholders

- Game designers tuning ship balance via `src/config` and `src/game/aiProfiles.ts`.
- Engineers focused on deterministic simulations, renderer performance, and robust Rapier integration.
- QA and automated testing teams that rely on seeded runs and Playwright visual baselines.

Primary constraints and assumptions

- Determinism: All simulation randomness must flow from the seeded RNG (`SeededRng` in `src/utils/rng.ts`) attached to the canonical `GameState` at `state.rng` (default seed: 1337).
- Canonical state: All runtime state is stored on `GameState` (types found under `src/types/` — see `src/types/simulation.ts` for the `GameState` interface). Avoid module-level mutable state.
- Physics: Rapier3D runs on the main thread and is stepped inside the `updateGame` pipeline; mutating operations that would clash with Rapier stepping must use the deferred mutation queues on `state.simulation`.

Success signals

- Deterministic unit tests (Vitest) and visual regression baselines (Playwright) reproduce results across runs when using the same seed and debug overrides.
- Systems are allocation-conscious and avoid per-frame garbage in hot loops (motion, turrets, projectiles).

Notes

- AI v2 is mandatory: the legacy fallback was removed and `ensureAiEnabled` (`src/game/systems/shipControl/aiSafety.ts`) forces `state.ai.enabled = true`; `src/app/uiStore.ts` ignores disable requests and logs a config warning. Tuner knobs remain in `src/game/config.ts` and `AI_CONFIG` exports.
- The memory bank (`memory/`) contains per-file summaries and design notes to help contributors locate authoritative code and integration points quickly.

Generated: 2025-10-03
