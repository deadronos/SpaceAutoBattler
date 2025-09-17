---
goal: Feature: Visual interpolation between simulation steps for smooth rendering
version: 1.0
date_created: 2025-09-17
last_updated: 2025-09-17
owner: SpaceAutoBattler maintainers
status: 'Planned'
tags: [feature, renderer, simulation, interpolation, types, tests]
---

# Introduction

![Status: Planned](https://img.shields.io/badge/status-Planned-blue)

Implement visual interpolation to ensure smooth rendering of entities (ships, bullets) when the simulation runs at a lower fixed timestep than the rendering framerate. The change introduces previous-state fields on entities, captures previous state at the start of each simulation step, and blends (LERP/SLERP) between previous and current state in the renderer.

## 1. Requirements & Constraints

- REQ-001: The renderer shall interpolate entity positions between simulation steps to reduce perceived stutter at render FPS > sim TPS.
- REQ-002: The renderer shall interpolate ship orientations (Euler or Quaternion) between simulation steps.
- REQ-003: The simulation shall capture per-entity previous state at the start of each sim step (before any state mutation).
- REQ-004: New entities (ships/bullets) shall initialize previous state equal to their initial current state to avoid spawn pops.
- REQ-005: Interpolation factor (alpha) shall be computed from elapsed time within the current simulation step and clamped to [0, 1].
- REQ-006: The change shall not alter deterministic simulation outcomes (all RNG-deterministic tests must remain green).

- SEC-001: No new external network calls or secrets introduced.

- CON-001: Edit only TypeScript under /src; do not modify /dist or non-source files.
- CON-002: Maintain canonical runtime state exclusively on GameState (src/types/index.ts).
- CON-003: Preserve determinism on all simulation code paths; no non-deterministic behavior introduced in sim logic.
- CON-004: Use sim tick rate from existing config (src/config/simConfig.ts); no hard-coded timing constants.
- CON-005: Keep physics/visual separation; do not access Three.js objects in the worker thread.

- GUD-001: Use asset pooling and renderer config patterns already present.
- GUD-002: Dispose/cleanup any renderer-side allocations per existing patterns.
- PAT-001: Fixed timestep simulation with variable-rate rendering; interpolation in render loop.

## 2. Implementation Steps

### Implementation Phase 1

- GOAL-001: Extend entity types to store previous-state for interpolation.

| Task     | Description                                                                                                                            | Completed | Date |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-001 | In src/types/index.ts, add `prevPos: Vector3` to `Ship` and `Bullet` interfaces (make required).                                       |           |      |
| TASK-002 | In src/types/index.ts, add `prevOrientation: Orientation` to `Ship` (match the existing Orientation type; do not change its kind).     |           |      |
| TASK-003 | Update any factory/types helpers creating `Ship`/`Bullet` to initialize `prevPos` and `prevOrientation` to current values on spawn.    |           |      |
| TASK-004 | Update test fixtures/factories (under test/vitest/**) creating `Ship`/`Bullet` objects to include the new required fields.             |           |      |

Completion criteria:
- TypeScript compiles (`npm run typecheck`) without missing field errors.
- Tests compile (even if runtime tests may fail in later phases).

### Implementation Phase 2

- GOAL-002: Capture previous-state at the start of each simulation step.

| Task     | Description                                                                                                                                                                                                                                      | Completed | Date |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- | ---- |
| TASK-005 | In src/simWorker.ts, at the top of the function that advances simulation (e.g., `stepSimulation(state: GameState, dt: number)`), loop over `state.ships` and `state.bullets` and copy `pos`→`prevPos`, `orientation`→`prevOrientation` (ships).   |           |      |
| TASK-006 | Ensure previous-state capture occurs strictly before any physics, AI, or position/orientation mutation occurs in the same step.                                                                                                                  |           |      |
| TASK-007 | Verify spawn paths still initialize prev fields (Phase 1) so the first interpolation frame doesn’t pop.                                                                                                                                          |           |      |

Implementation details for TASK-005:
- Ships:
  - `ship.prevPos = { x: ship.pos.x, y: ship.pos.y, z: ship.pos.z }`
  - `ship.prevOrientation = { ...ship.orientation }` (copy fields matching Orientation type)
- Bullets:
  - `bullet.prevPos = { x: bullet.pos.x, y: bullet.pos.y, z: bullet.pos.z }`

Completion criteria:
- No runtime diff to simulation state arrays/maps beyond new fields.
- Deterministic simulations unchanged (unit tests that assert sim outcomes still pass).

### Implementation Phase 3

- GOAL-003: Interpolate in the renderer using the factor alpha ∈ [0, 1].

| Task     | Description                                                                                                                                                                                                                                            | Completed | Date |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- | ---- |
| TASK-008 | In src/renderer/threeRenderer.ts (or renderer main loop), compute `fixedSimulationDt = 1 / simConfig.tickRate` using existing config; compute `alpha = clamp(elapsedWithinStep / fixedSimulationDt, 0, 1)`.                                             |           |      |
| TASK-009 | For each visible ship mesh: LERP position from `prevPos` to `pos` using `alpha`.                                                                                                                                                                      |           |      |
| TASK-010 | For ship orientation: if Three.js quaternions are used, SLERP from prev to current. If Euler angles are used, linear interpolate each angle field (noting limitations).                                                                                |           |      |
| TASK-011 | For bullets: LERP position from `prevPos` to `pos` using `alpha`.                                                                                                                                                                                      |           |      |
| TASK-012 | Ensure interpolation is renderer-only (no writes back to GameState); avoid side effects that affect simulation or tests.                                                                                                                               |           |      |
| TASK-013 | Optionally introduce `rendererConfig.enableInterpolation` (default true) to toggle; wire to interpolation branch without altering default visuals.                                                                                                      |           |      |

Implementation details:
- Alpha computation:
  - Track last completed sim step time and current wall time; or derive from state time modulo fixed dt.
  - Preferred: maintain `lastSimStepAt` timestamp in renderer when it receives sim step updates; compute `elapsedWithinStep = now - lastSimStepAt`.
- Position interpolation (per axis):
  - `renderPos = prev + (curr - prev) * alpha`
- Orientation:
  - Quaternion: use `mesh.quaternion.slerp(targetQuat, alpha)` or `THREE.Quaternion.slerp(prevQ, currQ, outQ, alpha)` then assign.
  - Euler: `roll/pitch/yaw` per-field interpolation; clamp to handle wrap-around if necessary.

Completion criteria:
- Visual movement is smooth at high FPS and low TPS.
- Feature toggle (if added) turns interpolation off without regressions.

### Implementation Phase 4

- GOAL-004: Tests, validation, and docs.

| Task     | Description                                                                                                                                                                                                                   | Completed | Date |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-014 | Add unit tests verifying prev-state capture runs before mutation (ship/bullet prev fields equal to prior step values, current fields updated after step).                                                                     |           |      |
| TASK-015 | Add unit tests for spawn initialization (prev == current on first frame).                                                                                                                                                     |           |      |
| TASK-016 | Add a small renderer-side unit test (or headless mocked test) to validate alpha computation is clamped and monotonically increasing within a step.                                                                           |           |      |
| TASK-017 | Run full suite: `npm run typecheck`; `npm test`; verify existing deterministic tests remain green.                                                                                                                            |           |      |
| TASK-018 | Update docs: add a short note to docs/renderer-pipeline.md about interpolation; link to this plan.                                                                                                                            |           |      |

Completion criteria:
- All unit tests pass; no type errors.
- Documentation updated and linked.

## 3. Alternatives

- ALT-001: Increase simulation tick rate to match render FPS. Rejected due to significant CPU cost and possible determinism impacts; violates performance goals.
- ALT-002: Extrapolation (predict next state rather than interpolate). Rejected due to overshoot artifacts and divergence risk; not needed for local, single-process sim.
- ALT-003: Shader-based interpolation via instancing attributes and GPU lerp. Deferred; adds complexity and attribute bandwidth; consider later for massive instance counts.
- ALT-004: Maintain history buffer >1 frame for motion blur/trails. Deferred; extra memory and complexity not required for core smoothing.

## 4. Dependencies

- DEP-001: Three.js rotation math in renderer (quaternion SLERP available).
- DEP-002: `src/config/simConfig.ts` provides tickRate; used to compute fixedSimulationDt.
- DEP-003: GameState shape in `src/types/index.ts`; prev fields must be added there.
- DEP-004: Worker-message cadence (main ↔ simWorker) must expose per-step timing or derivable `lastSimStepAt`.

## 5. Files

- FILE-001: src/types/index.ts — Add `prevPos` to Ship/Bullet and `prevOrientation` to Ship.
- FILE-002: src/simWorker.ts — Capture previous state at the start of each sim step.
- FILE-003: src/renderer/threeRenderer.ts — Compute alpha and interpolate per entity.
- FILE-004: src/config/rendererConfig.ts — Optional toggle `enableInterpolation` (default true).
- FILE-005: test/vitest/** — New and updated tests and fixtures for new fields.
- FILE-006: docs/renderer-pipeline.md — Document interpolation and link to this plan.

## 6. Testing

- TEST-001: Prev-state capture — Before any movement code, `prevPos` equals previous step `pos`; after step, `pos` differs when movement occurs.
- TEST-002: Spawn initialization — Newly spawned ship/bullet has `prevPos == pos` and (ships) `prevOrientation == orientation`.
- TEST-003: Alpha computation — With tickRate=10, `fixedDt=0.1`; if 0.035s elapsed, alpha≈0.35; alpha clamped to [0,1].
- TEST-004: Renderer lerp — Given prev=(0,0,0), curr=(10,0,0), alpha=0.5 → render position (5,0,0).
- TEST-005: Determinism — No change in deterministic unit tests that assert outcomes of the simulation (RNG seeded).
- TEST-006: Toggle (if implemented) — Disabling interpolation renders at exact sim positions (alpha ignored), no crashes.

## 7. Risks & Assumptions

- RISK-001: Orientation interpolation using Euler angles may suffer from gimbal/wrap issues; prefer quaternion when available.
- RISK-002: Slight memory overhead adding prev fields to all entities.
- RISK-003: Renderer alpha computation must sync to sim-step timing; incorrect derivation leads to jitter or stutter.

- ASSUMPTION-001: Orientation type in `Ship` is either Euler-like or quaternion; we mirror it for prevOrientation without changing its kind.
- ASSUMPTION-002: The sim step function resides in `src/simWorker.ts` and is the single point that mutates positions/orientations.
- ASSUMPTION-003: Renderer has access to sim tickRate from `src/config/simConfig.ts`.

## 8. Related Specifications / Further Reading

- docs/interpolation_plan.md
- AGENTS.md — Repository guidelines (determinism, canonical GameState)
- .github/copilot-instructions.md — Critical development rules
- docs/renderer-pipeline.md (to be updated)