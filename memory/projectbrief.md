# Project Brief — SpaceAutoBattler

**Purpose:** SpaceAutoBattler is a deterministic, configuration-driven 3D auto-battler that simulates fleet combat between Red and Blue teams. The repository separates simulation state/logic (Miniplex + Rapier3D stepped in R3F) and rendering (React Three Fiber) with configuration-driven tuning and seeded RNG so replays and tests are reproducible.

**Primary goals:**

- Provide a deterministic, testable simulation for automated fleet combat.
- Expose configuration-driven ship classes and behaviors so balance and tuning live in `src/game` and `src/config`.
- Keep a clear separation between game state, simulation, and renderer to support headless-style tests and an interactive visual frontend.

**Success criteria:**

- All runtime state lives on the canonical `GameState` type (see `src/types/simulation.ts`).
- Simulation determinism preserved via the seeded RNG (`src/utils/rng.ts`) — `createGameState()` currently initialises `state.rng = new SeededRng(1337)`. The runtime `SeededRng` API includes: `reset(seed)`, `next()` → [0..1), `range(min,max)`, `int(min,max)`, `pick(values[])`, and `normal(mean?, stdDev?)` (Box–Muller gaussian samples).
- Use of deferred mutation queues (`simulation.deferredMutations` and `simulation.postStepMutations`) prevents Rapier mutable-borrow errors during in-loop spawns/removals.

**Governance & memory bank:**

- Memory files under `memory/` are the canonical source for decisions, requirements, and designs. All significant changes should update the Memory Bank and link to PRs.

**Minimal EARS-style requirements (examples):**

- WHEN a simulation run is executed in CI, THE SYSTEM SHALL use a seeded RNG to produce repeatable outcomes (Acceptance: run the deterministic suite and compare replay snapshots).
- WHEN physics-related entity changes are necessary mid-tick, THE SYSTEM SHALL enqueue them into the post-step mutation queue to avoid Rapier aliasing errors [Acceptance: regression tests using `requestReset` and carrier launch flows validate no Rapier panics occur].

Generated: 2025-10-03
