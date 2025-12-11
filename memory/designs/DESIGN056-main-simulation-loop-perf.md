# DESIGN056  Main Simulation Loop Performance

Status: Proposed
Date: 2025-11-16
Author: GitHub Copilot (agent)

## Context

Hot path: `BattlefieldSystems` (`src/components/BattlefieldSystems.tsx`) driving `updateGame` (`src/game/systems.ts`).

- `BattlefieldSystems` runs every render frame via `useFrame`, potentially calling `updateGame` multiple times per frame using a fixed-step accumulator (`sim.accumulator`, `sim.step`, `sim.maxSubSteps`).
- `updateGame` advances AI, motion, projectiles, explosions, and syncs Rapier physics by stepping `state.physicsWorld.step()`.
- Every subsystem call is wrapped by `measureSubsystem` (two `performance.now()` calls) and `runSafely` (nested try/catch and optional `safeSnapshot(state)` capture on error).

This combination makes the simulation tick the single most critical CPU hotpath in the game.

## Findings

1. **Always-on profiling:** All subsystem updates are measured with `performance.now()` every tick, regardless of build, debug flags, or performance budget.
2. **Always-on defensive guards:** All subsystems run through `runSafely`, which may attempt to capture a `safeSnapshot(state)` on error; while rare, when triggered this is intentionally expensive.
3. **Potentially high substep counts:** For small `sim.step` and large `sim.maxSubSteps`, a single render frame can execute many full `updateGame` iterations, multiplying the cost of profiling and guards.
4. **Rapier step is correctly lean:** The `physicsWorld.step()` call is already isolated and free of logging or allocations inside the hot section; no change needed there, but it magnifies overhead from anything wrapped around it.

## Requirements (EARS)

- WHEN the game runs in normal play mode, THE SYSTEM SHALL be able to disable per-subsystem profiling overhead while keeping behavior identical. [Acceptance: flag off → `performance.now()` not called for subsystems; simulation output unchanged.]
- WHEN profiling is enabled, THE SYSTEM SHALL record per-subsystem durations with minimal additional overhead and optional sampling. [Acceptance: durations populated for selected ticks; no regressions in gameplay.]
- WHEN defensive guards are disabled for production runs, THE SYSTEM SHALL still allow a separate debug mode with `runSafely` + `safeSnapshot` for diagnosis. [Acceptance: toggling guard flag switches between guarded and direct code paths.]
- WHEN using fixed substeps, THE SYSTEM SHALL clamp `sim.maxSubSteps` to a safe range such that a single frame cannot execute unbounded simulation steps. [Acceptance: configuration prevents more than the configured maximum updates per frame.]

## Design: Configurable Profiling and Guards

### New configuration surface

Extend `GameState.simulation` or a nearby config surface with:

- `sim.profileSubsystems: boolean` — default `false` in production; `true` in debug or perf-investigation builds.
- `sim.profileSampleRate: number` — integer ≥ 1; only profile every Nth tick (default `1`).
- `sim.enableSubsystemGuards: boolean` — default `true` for dev builds, `false` for trusted production builds.

These flags can be wired to the existing debug overlay or a simple UI setting, but default values should be safe for players.

### Profiling path

Replace unconditional `measureSubsystem` usage with a conditional wrapper:

- Introduce an internal helper inside `updateGame`:
  - `const profileThisTick = sim.profileSubsystems && sim.lastTickIndex % sim.profileSampleRate === 0;`
  - If `profileThisTick` is `true`, use the existing `measureSubsystem` implementation.
  - If `profileThisTick` is `false`, call `runSafely(name, fn)` directly without `performance.now()`.
- Retain `timings.durations` map, but only update entries on profiled ticks; callers that display durations should handle the fact that values may be stale between profiled ticks.

### Guard path

Allow `runSafely` usage to be gated:

- Inside `updateGame`, define a `runSubsystem` function:
  - If `sim.enableSubsystemGuards` is `true`, delegate to `runSafely(name, fn)`.
  - If `false`, call `fn()` directly.
- `measureSubsystem` should use `runSubsystem` as its inner executor instead of calling `runSafely` directly.
- This keeps the implementation centralized while allowing low-overhead production builds for stable code.

### Substep clamping and tuning

- Ensure `sim.maxSubSteps` is sourced from a config with a clearly documented upper bound (e.g., `1 ≤ maxSubSteps ≤ 5`).
- Enforce the clamp in `BattlefieldSystems` before use:
  - `const maxSteps = Math.max(1, Math.min(sim.maxSubSteps, MAX_ALLOWED_SUBSTEPS));`
- Document recommended combos, for example:
  - 60 FPS, `step = 1/60`, `maxSubSteps = 2`.
  - 30 FPS fallback, `step = 1/60`, `maxSubSteps = 4`.

## Design: Data and API Changes

- `GameState.simulation` gains profiling and guard flags (with safe defaults wired in creation helpers).
- No changes to public `updateGame(state, delta)` signature.
- No changes to `BattlefieldSystems` public API; only the internal substep clamp constant is added.

## Validation Plan

- Add a small unit/integration test around `updateGame` that:
  - Mocks `performance.now()` to count invocations and asserts that profiling flags affect the count as expected.
  - Verifies that turning off guards still allows errors to propagate as before, while turning them on captures failures via `recordSubsystemFailure`.
- Use the existing debug overlay (if present) to manually confirm that timings still populate when profiling is on and remain stable when sampling.
- Run `npm test` and `npm run typecheck` after implementation.

## Risks and Mitigations

- **Risk:** Bugs caused by turning off guards may be harder to diagnose in production. Mitigation: keep guards enabled by default in CI/test environments and make toggling explicit in configuration.
- **Risk:** Sampling might confuse existing metrics consumers. Mitigation: ensure any UI visible timings clearly indicate sampled vs per-tick values.

## Follow-ups

- Expose profiling and guard flags through the debug UI to allow live toggling during performance sessions.
- Add a small doc entry to `docs/performance-best-practices.md` describing how to use subsystem profiling safely.
