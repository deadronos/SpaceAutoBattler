# [TASK102] - Implement Physical Movement System

**Status:** In Progress  
**Added:** 2025-09-22  
**Updated:** 2025-09-22

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

**Overall Status:** In Progress - 5% complete

### Subtasks

| ID  | Description                                    | Status      | Updated    | Notes                                        |
|-----|-----------------------------------------------|-------------|------------|----------------------------------------------|
| 1.1 | Add MotionStats interface to types           | Not Started |            | Phase 1: Foundation types                    |
| 1.2 | Update ship stats with motion defaults       | Not Started |            | Per-class tuning values                     |
| 1.3 | Add renderer smoothing config                 | Not Started |            | Fallback defaults                            |
| 1.4 | Add validation helpers                        | Not Started |            | Range validation for stats                   |
| 2.1 | Create motion system module                   | Not Started |            | Phase 2: Core physics implementation        |
| 2.2 | Implement angular PD control                  | Not Started |            | Shortest arc, rate limits                    |
| 2.3 | Add continuous angular damping                | Not Started |            | 1 - exp(-damping * dt)                      |
| 2.4 | Implement linear acceleration                 | Not Started |            | Forward thrust with speed caps              |
| 2.5 | Add lateral acceleration support              | Not Started |            | Optional strafe movement                     |
| 2.6 | Optimize allocation-free hot paths            | Not Started |            | Reuse temp vectors/quaternions              |
| 2.7 | Wire into main simulation loop                | Not Started |            | Call order after AI, before collision       |
| 3.1 | Track transform history in Ship.tsx          | Not Started |            | Phase 3: Visual smoothing                   |
| 3.2 | Apply lerp/slerp interpolation                | Not Started |            | No GameState mutations                       |
| 3.3 | Guard teleport/spawn edge cases               | Not Started |            | Reset prev state to avoid trails            |
| 4.1 | Compute banking from yaw rate                 | Not Started |            | Phase 4: Visual polish                      |
| 4.2 | Add smooth banking filter                     | Not Started |            | Low-pass to avoid jitter                    |
| 4.3 | Hook thruster VFX to throttle                 | Not Started |            | Visual feedback for thrust                   |

## Progress Log

### 2025-09-22

- Created task file and implementation plan
- Analyzed current codebase structure and existing ship/physics systems
- Verified tests pass and TypeScript compiles cleanly
- Starting Phase 1: Motion Stats Types & Defaults