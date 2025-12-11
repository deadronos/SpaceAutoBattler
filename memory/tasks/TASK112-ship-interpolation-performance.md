# TASK112 — Ship interpolation performance

**Status:** In Progress  
**Added:** 2025-11-17  
**Updated:** 2025-11-17

## Original Request

Create a `/memory/tasks` plan for DESIGN060 (ship interpolation and visual smoothing performance) so the design can be executed, validated, and tracked.

## Thought Process

- DESIGN060 targets the `useShipInterpolation` / `updateInterpolation` hot path where per-frame math (smoothing, bobbing, banking) scales with ship count.
- Adding LOD/performance-tier awareness should let us dial back optional visual work for distant/low-importance ships without altering gameplay state.
- Global performance flags and early-outs can reduce per-frame trig/exp calls while keeping high-detail behavior intact for nearby ships.
- Capturing this as a task keeps the spec-driven loop traceable (design → plan → validation) and aligns tests/perf captures with the new controls.

## Implementation Plan

- Feed LOD/performance tier into interpolation: surface `visualDetailLevel` (or equivalent) on ship entities and plumb it through `useShipInterpolation` to let `updateInterpolation` choose feature tiers (full/medium/low).
- Add renderer performance controls: extend `RENDERER_VISUAL_CONFIG` with `performanceTier` plus `enableShipBob` / `enableShipBanking` flags, and wire a toggle or config setter that can switch tiers at runtime.
- Implement early-outs and cheap paths in `updateInterpolation`: if smoothing is disabled and `alpha` is 0/1, copy the pose and return; gate bob/bank by LOD/performance; prefer simpler bank math when perf tier is low.
- Validation: add unit tests for early-outs and LOD/perf gating of bob/bank; run a many-ship scenario CPU profile comparing high vs low performance tiers and record notes.

## Progress Tracking

**Overall Status:** In Progress - 75%

### Subtasks

| ID  | Description                                                                                                                    | Status      | Updated    | Notes                                                                               |
| --- | ------------------------------------------------------------------------------------------------------------------------------ | ----------- | ---------- | ----------------------------------------------------------------------------------- |
| 1.1 | Integrate ship LOD/importance into interpolation and expose a `visualDetailLevel` the hook can consume.                        | Complete    | 2025-11-17 | Added `visualDetailLevel` hint and AI LOD fallback for effective detail level.      |
| 1.2 | Extend renderer visual config with performance tier (`high/medium/low`) and bob/bank flags plus runtime toggle.                | Complete    | 2025-11-17 | Global config now includes bob/bank toggles and `performanceTier`.                  |
| 1.3 | Add early-outs/cheap paths in `updateInterpolation` to skip smoothing math when disabled or trivial and gate bob/bank by tier. | Complete    | 2025-11-17 | Added detail-aware gating, trivial path short-circuit, and simple banking fallback. |
| 1.4 | Add tests and capture perf notes demonstrating reduced CPU for low-tier/low-LOD ships.                                         | In Progress | 2025-11-17 | Vitest coverage added; perf capture still pending.                                  |

## Progress Log

### 2025-11-17

- Created task from DESIGN060 to track ship interpolation/visual smoothing performance work, outlining LOD/performance-tier gating, global flags, early-outs, and validation needs.
- Implemented performance-tier + LOD-aware gating for interpolation, bobbing, and banking; added global bob/bank toggles, trivial-path short-circuit, and detail-level hint on ships. Added Vitest cases for perf tiers and short-circuiting (`vitest --environment happy-dom test/vitest/ship-interpolation.spec.ts`). Perf capture/alloc notes still TODO.
