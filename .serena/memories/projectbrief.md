# Project Brief — SpaceAutoBattler

**Purpose:** SpaceAutoBattler is a deterministic, configuration-driven 3D auto-battler that simulates fleet combat between Red and Blue teams. The repository separates simulation state/logic (Miniplex + Rapier3D stepped in R3F) and rendering (React Three Fiber) with configuration-driven tuning and seeded RNG so replays and tests are reproducible.

**Primary goals:**

- Provide a deterministic, testable simulation for automated fleet combat.
- Expose configuration-driven ship classes and behaviors so balance and tuning live in `src/game` and `src/config`.
- Keep a clear separation between game state, simulation, and renderer to support headless-style tests and an interactive visual frontend.

**Success criteria:**

- All runtime state lives on the canonical `GameState` type (`src/types/index.ts`).
- Simulation determinism preserved via the seeded RNG (`src/utils/rng.ts`).
- Fast unit tests (Vitest) and reproducible CI builds.

**Governance & memory bank:**

- Memory files under `memory/` are the canonical source for decisions, requirements, and designs. All significant changes (requirements, design decisions, and task mappings) should be reflected in the Memory Bank and referenced in PRs.

**Recent updates (summary):**

- 2025-09-25 → 2025-09-29: Delivered a series of renderer and determinism updates including the CelestialEnvironment components, deterministic star-disk textures, Playwright capture workflow for before/after comparisons, and test hardening for ship progression scenarios.

**Minimal EARS-style requirements (examples):**

- WHEN a simulation run is executed in CI, THE SYSTEM SHALL use a seeded RNG to produce repeatable outcomes [Acceptance: run the `determinism.spec.ts` suite and compare replay snapshots].
- WHEN visual regressions are evaluated, THE SYSTEM SHALL produce Playwright before/after captures deterministically given the same seed and debug overrides [Acceptance: `playwright-debug/` captures match saved baselines on the CI job].

Generated: 2025-09-29
