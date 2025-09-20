# Project Brief — SpaceAutoBattler

**Purpose:** SpaceAutoBattler is a deterministic, configuration-driven 3D auto-battler that simulates fleet combat between Red and Blue teams. The repository separates pure game logic (core), deterministic physics simulation (simWorker using Rapier3D), and rendering (Three.js) with an asset pooling system and seeded RNG so replays and tests are reproducible.

**Primary goals:**

- Provide a deterministic, testable simulation for automated fleet combat.
- Expose configuration-driven ship classes, behaviors, and progression so balance and tuning live in `src/config`.
- Keep a clear separation between game state, simulation, and renderer to support a headless simulation and an interactive visual frontend.

**Success criteria:**

- All runtime state lives on the canonical `GameState` type (`src/types/index.ts`).
- Simulation determinism preserved via the seeded RNG (`src/utils/rng.ts`).
- Fast unit tests (Vitest) and reproducible CI builds.

Generated: 2025-09-15
