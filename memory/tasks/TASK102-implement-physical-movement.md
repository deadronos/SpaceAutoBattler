# [TASK102] - Implement Physical Movement System

**Status:** In Review  
**Added:** 2025-09-22  
**Updated:** 2025-09-24

## Original Request

Follow and implement `/plan/plan-physical-movement.md` to add deterministic physics-based ship movement with renderer smoothing and banking.

## Thought Process

The current ship movement system uses simple kinematic positioning without acceleration limits or proper physics. The plan calls for:

1. Adding `MotionStats` interface with mass, acceleration limits, damping, and turn rates
2. Implementing PD-like angular control for smooth turning
3. Adding linear acceleration with speed caps and damping
4. Creating renderer-side interpolation for 60fps smoothness at 20Hz sim rate
5. Adding visual banking proportional to yaw rate
6. Maintaining deterministic simulation with no renderer feedback

This aligns with the project constraints: all state on GameState, deterministic RNG usage, zero allocations in hot paths.

## Implementation Plan

- Phase 1: Motion Stats Types & Defaults (TASK-001 through TASK-004)
- Phase 2: Deterministic Motion System (TASK-005 through TASK-011) 
- Phase 3: Renderer Interpolation (TASK-012 through TASK-014)
- Phase 4: Visual Banking & VFX (TASK-015 through TASK-017)
- Phase 5: Unit & Integration Tests (TASK-018 through TASK-020)
- Phase 6: E2E Testing (TASK-021 through TASK-022)
- Phase 7: Documentation & Tuning (TASK-023 through TASK-025)

## Progress Tracking

**Overall Status:** In Review - 100% complete

### Subtasks

| ID  | Description                                    | Status      | Updated    | Notes |
|-----|-----------------------------------------------|-------------|------------|----------------------------------------------|
| 1.1 | Add MotionStats interface to types             | Complete    | 2025-09-22 | Phase 1: Foundation types                    |
| 1.2 | Update ship stats with motion defaults         | Complete    | 2025-09-22 | Per-class tuning values                      |
| 1.3 | Add renderer smoothing config                  | Complete    | 2025-09-23 | Global defaults for interpolation/banking    |
| 1.4 | Add validation helpers                         | Complete    | 2025-09-23 | Motion stats range guard                     |
| 2.1 | Create motion system module                    | Complete    | 2025-09-22 | Phase 2: Core physics implementation         |
| 2.2 | Implement angular PD control                   | Complete    | 2025-09-22 | Shortest arc, rate limits                    |
| 2.3 | Add continuous angular damping                 | Complete    | 2025-09-22 | 1 - exp(-damping * dt)                       |
| 2.4 | Implement linear acceleration                  | Complete    | 2025-09-22 | Forward thrust with speed caps               |
| 2.5 | Add lateral acceleration support               | Complete    | 2025-09-23 | Command-driven strafe & telemetry            |
| 2.6 | Optimize allocation-free hot paths             | Complete    | 2025-09-22 | Reuse temp vectors/quaternions               |
| 2.7 | Wire into main simulation loop                 | Complete    | 2025-09-22 | Call order after AI, before collision        |
| 3.1 | Track transform history in Ship.tsx            | Complete    | 2025-09-23 | Cached prev/curr transforms for lerp         |
| 3.2 | Apply lerp/slerp interpolation                 | Complete    | 2025-09-23 | Visual smoothing via fixed-step alpha        |
| 3.3 | Guard teleport/spawn edge cases                | Complete    | 2025-09-23 | Teleport threshold resets interpolation      |
| 4.1 | Compute banking from yaw rate                  | Complete    | 2025-09-23 | Uses angular velocity & lateral ratio        |
| 4.2 | Add smooth banking filter                      | Complete    | 2025-09-23 | Low-pass filtered roll clamp                 |
| 4.3 | Hook thruster VFX to throttle                  | Complete    | 2025-09-23 | Emissive intensity scales with thrust |
| 5.1 | Add motion math unit tests                   | Complete    | 2025-09-22 | Covered wrap/damping/accel clamp cases |
| 5.2 | Add motion system integration scenarios        | Complete    | 2025-09-22 | Forward accel & turn validations        |
| 5.3 | Add determinism regression coverage            | Complete    | 2025-09-22 | Replayed seeds across multiple ticks    |
| 6.1 | Author Playwright movement smoke                | Complete    | 2025-09-24 | Samples ship transforms via __SAB API   |
| 6.2 | Enforce heuristics + role-based locators        | Complete    | 2025-09-24 | Monitors displacement & rotation bounds |
| 7.1 | Link movement spec from README                  | Complete    | 2025-09-24 | Added dedicated doc section             |
| 7.2 | Document MotionStats tuning notes               | Complete    | 2025-09-22 | Inline comments on per-hull defaults    |
| 7.3 | Add troubleshooting notes to docs               | Complete    | 2025-09-24 | Diagnosed dt spikes & teleports         |
     |

## Progress Log

### 2025-09-22

- Created task file and implementation plan
- Analyzed current codebase structure and existing ship/physics systems
- Verified tests pass and TypeScript compiles cleanly
- Starting Phase 1: Motion Stats Types & Defaults
- **PHASE 1 COMPLETE**: Added MotionStats interface with mass, acceleration, damping, and turn rates to types
- Extended ShipComponent with velocity, angularVelocity, and motion fields
- Added motion stats defaults for all ship classes (fighter through carrier) with realistic values
- Updated spawnShip function to initialize new motion fields
- Fixed all test files to include required motion fields using createDefaultMotionStats helper
- All 54 tests pass and TypeScript compiles cleanly
- Ready to start Phase 2: Deterministic Motion System
- **PHASE 2 COMPLETE**: Created comprehensive motion system with PD angular control and linear acceleration
- Implemented updateMotionSystem with shortest-arc error calculation for smooth turning
- Added continuous damping using exponential decay formulas: exp(-damping * dt)
- Integrated forward acceleration with speed caps and world bounds clamping
- Wired motion system into main simulation loop after AI decisions but before physics step
- Created motion math utilities (shortestAngle, dampingFactor) with 9 unit tests
- Added motion system behavior tests with 6 integration scenarios
- All 69 tests pass including 15 new motion system tests
- System maintains zero per-frame allocations using temp objects
- Ready to start Phase 3: Renderer Interpolation for visual smoothing

### 2025-09-23

- Added renderer motion defaults (lerp/slerp/bank clamps) and motion validation helpers.
- Extended ship stats with smoothing/banking overrides and validated all hull presets.
- Enabled strafe acceleration in the motion system while tracking last lateral accel for visuals.
- Converted battlefield loop to fixed-step simulation with interpolation alpha tracking.
- Implemented Ship renderer smoothing (prev/curr sampling, lerp/slerp, teleport guard).
- Added procedural banking and thruster intensity feedback tied to throttle.
- Updated tests and helpers to carry the new motion fields.

### 2025-09-24

- Extended `__SAB` diagnostics to expose deterministic ship motion snapshots for automation.
- Authored Playwright movement heuristic that samples ship transforms over 32 ticks and asserts bounded deltas.
- Verified role-based locator usage and avoided hard waits by relying on web-first polling.
- Documented troubleshooting guidance for dt spikes, teleports, and retarget jitter.
- Linked the motion specification from the README to guide future implementers.
- Updated task metadata and plan status to reflect completion of phases 6 and 7.
