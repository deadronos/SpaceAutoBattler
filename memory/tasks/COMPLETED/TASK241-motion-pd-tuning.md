# [TASK241] - Reduce AI Bobbing via Motion PD Tuning

**Status:** Completed  
**Added:** 2025-10-03  
**Updated:** 2025-10-03

## Original Request

Improve "aibobbing" by exposing per-hull motion configurables, documenting recommended values, and eliminating oscillations caused by poorly tuned PD control and smoothing.

## Thought Process

- PD controller gains are currently hardcoded, so light fighters and heavy carriers share the same angular response despite different inertia.
- Rotation slerp smoothing executes even when the physics integration has already aligned the hull, reintroducing error and causing a visible bobbing loop.
- Designers need documented guidance for setting motion-related parameters per hull.

## Implementation Plan

- Audit `updateAngularMotion` to identify where to inject hull-specific tuning and how to gate smoothing near alignment.
- Extend `MotionStats` with explicit angular settling parameters and defaults; update data fixtures for each hull.
- Rework angular damping logic to honor the new stats and avoid redundant slerp corrections.
- Add Vitest coverage that exercises the tuned controller with custom stats and verifies damped convergence.
- Document the tuning controls and recommended ranges for designers.

## Progress Tracking

**Overall Status:** Completed - 100%

### Subtasks

| ID  | Description                                               | Status       | Updated    | Notes |
| --- | --------------------------------------------------------- | ------------ | ---------- | ----- |
| 1.1 | Analyze controller/smoothing interaction and gather data  | Completed    | 2025-10-03 | Collected PD vs smoothing observations and requirements.
| 1.2 | Design updated motion tuning interface and defaults       | Completed    | 2025-10-03 | Authored design in memory/designs/TASK241-motion-pd-tuning.md.
| 1.3 | Implement code changes and tuned hull values              | Completed    | 2025-10-03 | Added per-hull gains, settling logic, and smoothing gates.
| 1.4 | Add tests validating damping and configurability          | Completed    | 2025-10-03 | Extended motion.system/bloom specs with new assertions.
| 1.5 | Document tuning guidance and update memory artifacts      | Completed    | 2025-10-03 | Added spec/motion-tuning.md and refreshed active context.

## Progress Log

### 2025-10-03

- Task initialized.

### 2025-10-03

- Captured requirements, opened task file, and analyzed PD/slerp interaction.
- Wrote design doc covering MotionStats extensions and settling logic.

### 2025-10-03

- Implemented hull-specific angular control config with settling band gating and rotation smoothing guards.
- Tuned ship stats with recommended PD gains and settling rates; updated validation to cover new fields.
- Added motion system coverage for gains/settling behavior and stabilized bloom provider tests.
- Authored spec/motion-tuning.md and updated memory artifacts.


