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
- Per-entity buffers: Ship entities maintain a small `shieldRipples` buffer for renderer-driven visual ripples; capped length to avoid unbounded memory growth.

Testing & CI

- Tests should seed the RNG for deterministic behavior and create small `GameState` instances for integration tests.
- Typecheck (`npm run typecheck`) and unit tests (`npm test`) are required before commits.

Generated: 2025-09-21
