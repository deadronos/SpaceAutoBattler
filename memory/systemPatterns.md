# System Patterns — SpaceAutoBattler

This document captures architecture and recurring patterns used across the codebase.

Overview

- Canonical GameState: All runtime state lives on the `GameState` type defined in `src/types/index.ts`. Avoid module-level state.
- Simulation / Renderer separation: Simulation (ECS + Rapier) exists in `src/game/*` and is deterministic; renderer components in `src/components/*` read from `GameState` and are side-effect free.
- Deterministic RNG: Use `state.rng` (seeded RNG in `src/utils/rng.ts`) for any simulation randomness; never use `Math.random()` in simulation paths.
- Resource lifecycle: GLTFs loaded via Drei `useGLTF` (cached); dispose of Three.js resources created manually.
- Hot-path allocation avoidance: Systems avoid per-frame allocations; use temp vectors and pooling where appropriate.

Common patterns

- createGameState()/disposeGameState() factory: `src/game/state.ts` provides lifecycle for Rapier world, Miniplex world, and seeded RNG.
- Systems composition: `src/game/systems.ts` composes small, focused functions (prepareShips, advanceProjectiles, syncTransforms, resolveProjectiles) executed each tick via `updateGame(state, delta)`.
- Safe mutation pattern: Use `state.simulation.deferredMutations` and `state.simulation.postStepMutations` and the helpers in `src/game/simulationQueue.ts` to schedule Rapier-sensitive operations and avoid in-step mutations.
- Safe kinematics helpers: Prefer `src/game/physics/safeKinematics.ts` wrappers when writing kinematic transforms from systems that may run during physics steps.
- Testing hooks: Decision and AI subsystems expose test helpers (e.g., `__aiTestHooks`) and exported tick runners so unit tests can assert internal scoring and tie-break behavior without widening the public API.
- Per-entity buffers: Ship entities maintain a small `shieldRipples` buffer for renderer-driven visual ripples; capped length to avoid unbounded memory growth.

Testing & CI

- Tests should seed the RNG for deterministic behavior and create small `GameState` instances for integration tests.
- Typecheck (`npm run typecheck`) and unit tests (`npm test`) are required before commits.
- Playwright visual baselines: Visual regression captures (Playwright) are automated via `test/playwright/` and use the same deterministic debug overrides and seed values as unit determinism suites. These baselines are part of the verification story and should be updated when shader presets or renderer defaults change.

Memory Bank & Decisions

- Record design decisions, requirement EARS statements, and task mappings inside `memory/` (e.g., `memory/requirements.md`, `memory/design.md`, `memory/tasks/`). Use these files to preserve context for future work and PRs.
- When renaming or remapping task IDs (for example TASK102→TASK136), update cross-references across memory files and `memory/tasks/_index.md` and run markdown/link linting to avoid stale links.

Last updated: 2025-09-29
