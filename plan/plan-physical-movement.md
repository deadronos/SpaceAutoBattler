---
goal: Implement deterministic physics-based ship movement with renderer smoothing and banking
version: 1.0
date_created: 2025-09-22
last_updated: 2025-09-24
owner: SpaceAutoBattler Maintainers
status: 'In Review'
tags:
	- feature
	- architecture
	- simulation
	- renderer
	- deterministic
---

# Introduction

![Status: In Review](https://img.shields.io/badge/status-In%20Review-yellow)

This plan implements deterministic, acceleration-limited ship motion in the simulation (canonical GameState) and adds renderer-side smoothing (lerp/slerp) and procedural banking/visual cues. It is derived from `spec/spec-physical-movement.md` and adheres to project constraints: all state lives in GameState and simulation remains deterministic.

## 1. Requirements & Constraints

- **REQ-001**: Add per-ship motion stats (mass, maxSpeed, linearAcceleration, linearDamping, maxTurnRate, angularAcceleration, angularDamping, optional lateral accel).
- **REQ-002**: Implement acceleration-limited linear and angular dynamics with dt-aware clamps and damping.
- **REQ-003**: Keep simulation deterministic; no renderer feedback to GameState.
- **REQ-004**: Add renderer interpolation (lerp for positions, slerp for quaternions) between sim ticks.
- **REQ-005**: Add visual banking proportional to yaw rate or lateral acceleration with clamped roll.
- **REQ-006**: Avoid per-frame allocations in hot paths.
- **SEC-001**: Do not use non-deterministic APIs on simulation paths.
- **CON-001**: All runtime state on canonical GameState; no module-level state.
- **CON-002**: Use existing config helpers; avoid hardcoded constants in systems.
- **GUD-001**: Prefer PD-like angular control; torque-style optional as variant.
- **PAT-001**: Separate sim vs renderer concerns.

## 2. Implementation Steps

### Implementation Phase 1

- GOAL-001: Add motion stats types and per-class defaults.

| Task     | Description                                                                                                       | Completed | Date       |
| -------- | ----------------------------------------------------------------------------------------------------------------- | --------- | ---------- |
| TASK-001 | Update `src/types/index.ts`: add `MotionStats` interface per spec and extend ship config types to include it.     | ✅        | 2025-09-22 |
| TASK-002 | Update `src/game/ships.ts`: define default `MotionStats` per ship class; units consistent (deg/s, deg/s²).       | ✅        | 2025-09-22 |
| TASK-003 | Add global renderer smoothing defaults in config (fallbacks) in `src/config/renderer.ts` if not present.         | ✅        | 2025-09-23 |
| TASK-004 | Add validation helpers for stats ranges in `src/game/config.ts` or a new `src/game/validation.ts`.               | ✅        | 2025-09-23 |
Completion criteria:

- Types compile with `npm run typecheck`.
- Each ship class exposes MotionStats defaults with comments on units.
- No lint/type errors.

### Implementation Phase 2

- GOAL-002: Implement deterministic motion system (linear + angular PD control).

| Task     | Description                                                                                                      | Completed | Date       |
| -------- | ---------------------------------------------------------------------------------------------------------------- | --------- | ---------- |
| TASK-005 | Create `src/game/systems/motion.ts`: export `updateMotionSystem(state: GameState, dt: number)` implementation.    | ✅        | 2025-09-22 |
| TASK-006 | Implement PD-like angular control: shortest-arc error, target angular velocity clamp by `maxTurnRate`, limit change by `angularAcceleration*dt`. | ✅        | 2025-09-22 |
| TASK-007 | Integrate angular damping with continuous decay `1 - exp(-angularDamping * dt)`; update entity quaternion by angular velocity.                    | ✅        | 2025-09-22 |
| TASK-008 | Implement linear acceleration along forward: clamp by `linearAcceleration`; cap speed by `maxSpeed`; apply continuous linear damping.             | ✅        | 2025-09-22 |
| TASK-009 | Optional lateral accel: apply strafe acceleration limited by `maxLateralAcceleration` if enabled.               | ✅        | 2025-09-23 |
| TASK-010 | Ensure no per-frame allocations; reuse vector/quaternion temporaries; add internal math helpers.                | ✅        | 2025-09-22 |
| TASK-011 | Wire system into main sim loop in `src/game/systems.ts` (call order after AI target selection, before collision/visual sync).                     | ✅        | 2025-09-22 |
Completion criteria:

- Deterministic outputs for identical inputs across runs.
- No runtime allocations in hot path (spot-check with profiler/devtools if available).
- Ships turn and accelerate smoothly according to stats.

### Implementation Phase 3

- GOAL-003: Add renderer interpolation (visual-only).

| Task     | Description                                                                                                  | Completed | Date       |
| -------- | ---------------------------------------------------------------------------------------------------------------- | --------- | ---------- |
| TASK-012 | In `src/components/Ship.tsx`, track prev and current sim transforms per entity; compute alpha = (renderTime - simTickStart) / simDelta (clamped). | ✅        | 2025-09-23 |
| TASK-013 | Apply `lerp` to positions and `slerp` to rotations for visual transform; do not mutate GameState.             | ✅        | 2025-09-23 |
| TASK-014 | Guard teleports/spawns: reset prev state to current to avoid interpolation trails.                             | ✅        | 2025-09-23 |
Completion criteria:

- Visual motion remains smooth at 60 FPS when sim runs at 20 Hz.
- No GameState mutations from renderer.

### Implementation Phase 4

- GOAL-004: Add visual banking and VFX coupling.

| Task     | Description                                                                                                  | Completed | Date       |
| -------- | ---------------------------------------------------------------------------------------------------------------- | --------- | ---------- |
| TASK-015 | In `src/components/Ship.tsx`, compute roll angle from yaw rate and/or lateral acceleration; clamp by `maxBankDeg`. | ✅        | 2025-09-23 |
| TASK-016 | Smooth bank with a small low-pass filter to avoid jitter; apply as extra roll on top of sim rotation.            | ✅        | 2025-09-23 |
| TASK-017 | Hook thruster VFX intensity to forward/lateral throttle where available (e.g., material uniforms or particle emitters). | ✅        | 2025-09-23 |
Completion criteria:

- Ships visually bank into turns with stable roll.
- Thruster VFX reflect thrust usage.

### Implementation Phase 5

- GOAL-005: Add unit and integration tests for motion math and system behavior.

| Task     | Description                                                                                               | Completed | Date       |
| -------- | --------------------------------------------------------------------------------------------------------- | --------- | ---------- |
| TASK-018 | Create `test/vitest/motion.math.spec.ts`: angle wrap, PD step clamping, damping function, linear accel clamping tests. | ✅        | 2025-09-22 |
| TASK-019 | Create `test/vitest/motion.system.spec.ts`: simulate 180° turn and forward accel; verify arrival times and caps within tolerances.                | ✅        | 2025-09-22 |
| TASK-020 | Add determinism test: identical seeds/inputs produce identical state sequences over N ticks.               | ✅        | 2025-09-22 |
Completion criteria:

- Tests pass locally and in CI.
- Coverage ≥ 90% on new motion code.

### Implementation Phase 6

- GOAL-006: Add basic Playwright E2E smoke for visuals.

| Task     | Description                                                                                                   | Completed | Date       |
| -------- | ----------------------------------------------------------------------------------------------------------------- | --------- | ---------- |
| TASK-021 | Create `test/playwright/movement.spec.ts`: start scenario, spawn ships, assert angle/position changes are monotonic and not snapping (heuristic). | ✅        | 2025-09-24 |
| TASK-022 | Use role-based locators and web-first assertions; avoid hard waits; bind minimal time window to observe turning/accel. | ✅        | 2025-09-24 |
Completion criteria:

- E2E smoke passes consistently on CI and local.

### Implementation Phase 7

- GOAL-007: Documentation, tuning defaults, and rollout.

| Task     | Description                                                                                          | Completed | Date       |
| -------- | ---------------------------------------------------------------------------------------------------- | --------- | ---------- |
| TASK-023 | Update docs to link `spec/spec-physical-movement.md` from main docs index or README.                 | ✅        | 2025-09-24 |
| TASK-024 | Tune `src/game/ships.ts` MotionStats per class (Fighter/Corvette/Frigate/etc.); document tuning notes in code comments. | ✅        | 2025-09-22 |
| TASK-025 | Add troubleshooting notes (dt spikes, teleports, target flip-flop) to `docs/` or README.             | ✅        | 2025-09-24 |
Completion criteria:

- Defaults feel good in quick manual test.
- Docs reflect new behavior and tuning controls.

## 3. Alternatives

- **ALT-001**: Renderer smoothing only (no sim changes). Rejected: hides jumpiness without fixing underlying sim; causes divergence under load.
- **ALT-002**: Pure torque-based physics with inertia tensors. Deferred: more complex and heavier; PD control meets current goals with simpler tuning.
- **ALT-003**: Direct kinematic snapping with heavy visual springs. Rejected: risks “floaty” mismatch between sim and visuals.

## 4. Dependencies

- **DEP-001**: Vector/quaternion math (Three.js or existing math utils) available in both sim and renderer.
- **DEP-002**: ECS/system loop wiring in `src/game/systems.ts`.
- **DEP-003**: Existing config helpers `src/config/*`.

## 5. Files

- **FILE-001**: `spec/spec-physical-movement.md` — authoritative spec (reference).
- **FILE-002**: `src/types/index.ts` — add `MotionStats`; extend ship entity/config types.
- **FILE-003**: `src/game/ships.ts` — per-class MotionStats defaults.
- **FILE-004**: `src/game/systems/motion.ts` — new motion system (export `updateMotionSystem`).
- **FILE-005**: `src/game/systems.ts` — wire `updateMotionSystem` into tick order.
- **FILE-006**: `src/components/Ship.tsx` — add interpolation and banking visuals.
- **FILE-007**: `src/config/renderer.ts` — optional smoothing defaults (fallbacks).
- **FILE-008**: `test/vitest/motion.math.spec.ts` — unit tests.
- **FILE-009**: `test/vitest/motion.system.spec.ts` — integration tests.
- **FILE-010**: `test/playwright/movement.spec.ts` — E2E smoke.

## 6. Testing

- **TEST-001**: Angle wrap computes shortest arc near ±180° reliably.
- **TEST-002**: PD angular step clamps to `maxTurnRate` and `angularAcceleration * dt`.
- **TEST-003**: Linear accel clamps and speed cap respected.
- **TEST-004**: Damping decay matches `1 - exp(-damping * dt)` within float tolerance.
- **TEST-005**: 180° turn finishes within ±10% of theoretical time per stats.
- **TEST-006**: Determinism: full scenario produces identical state trace.
- **TEST-007**: Renderer smoothing: heuristic frame-to-frame angular delta below threshold; no snaps observed.

## 7. Risks & Assumptions

- **RISK-001**: Over-smoothing can cause sluggish responsiveness. Mitigation: expose per-ship stats and banking clamps; use PD not full integral control.
- **RISK-002**: Performance regressions with many entities. Mitigation: no allocations; reuse temporaries; micro-benchmark hot path.
- **RISK-003**: Visual-sim divergence confusion. Mitigation: renderer never writes to GameState; document behavior.
- **ASSUMPTION-001**: Current ECS exposes per-entity transform/velocity; systems order can be adjusted.

## 8. Related Specifications / Further Reading

- `spec/spec-physical-movement.md`
- `AGENTS.md` — repository constraints (GameState determinism, state locality)
- `docs/r3f-drei-webgl-performance-best-practices.md`
