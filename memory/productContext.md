# Product Context — SpaceAutoBattler

SpaceAutoBattler is a small deterministic 3D auto-battler project used to experiment with AI, physics-driven interactions, and rendering patterns. It is both a playground for design of configurable ship classes and an integration example for deterministic simulations in the browser using React Three Fiber and Rapier3D.

Key users and stakeholders:

- Game designers tuning ship balance via `src/config`.
- Engineers working on deterministic simulations, renderer performance, and inter-thread messaging.
- Automated testing and CI for reproducible runs and regression detection.

Primary constraints and assumptions:

- Determinism is required for replay and reliable tests. Use the seeded RNG in `src/utils/rng.ts` for simulation logic.
- All runtime state must be stored on the `GameState` type in `src/types/index.ts`.
- Physics runs on the main thread (Rapier3D stepped inside R3F). Renderer is decoupled from simulation logic via ECS.

Generated: 2025-09-21
