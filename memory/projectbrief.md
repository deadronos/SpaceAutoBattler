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

Generated: 2025-09-21
