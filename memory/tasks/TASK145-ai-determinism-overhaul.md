# TASK145 - Implement AI Determinism & Coordination Overhaul

**Status:** In Progress  
**Added:** 2025-09-28  
**Updated:** 2025-09-28

## Original Request

Execute the AI decision determinism and coordination improvements captured in `memory/design-ai-determinism-v0.1.1.md`, ensuring documentation-driven development with traceable requirements, comprehensive testing, and progress tracking via the Memory Bank.

## Thought Process

The existing AI decision pipeline suffers from coarse score quantisation, non-deterministic tie resolution, distance-biased targeting, sluggish reaction to critical events, constrained vertical manoeuvres, and limited telemetry. Addressing these issues requires coordinated updates across scoring helpers, target blackboard, scheduler interrupts, heading execution, configuration constants, and diagnostics. Work must remain deterministic (seeded RNG only as last resort) and align with the canonical `GameState` and scheduler infrastructure. We must stage the effort to secure determinism first, then layering prioritisation, responsiveness, vertical tuning, and diagnostics while keeping performance and KPI stability in check.

## Implementation Plan

- [x] **Score precision & comparator (P0):** Quantise scores to 0.1 resolution, replace `Math.floor` usage, implement comparator ordering (intent rank → threat rank → distance → ship index), and instrument tie metrics.
- [x] **Target prioritisation (P0):** Extend blackboard caches with threat-weighted ordering and focus-fire tracking; update intent selection to prefer highest threat targets with deterministic ordering.
- [ ] **Interrupt responsiveness (P0):** Introduce interrupt manager tracking HP drops, VIP threats, and target loss; ensure `nextThinkAt` snaps to the current tick and record latency metrics.
- [ ] **Vertical clamp expansion (P1):** Parameterise heading Y clamp by profile role and band error; expand range for agile hulls while preserving deterministic behaviour.
- [ ] **Diagnostics expansion (P1):** Extend metrics payload with tie count, comparator fallbacks, decision latency histogram, focus-fire ratios, and vertical amplitude distribution; update harness serialization and consumer tooling.
- [ ] **Scoring enrichment & tuning (P1/P2):** Integrate threat/focus weighting into intent scores, rebalance constants, and validate KPI/telemetry baselines; retain toggles for incremental rollout.

## Progress Tracking

**Overall Status:** In Progress - 20%

### Subtasks

| ID  | Description                                             | Status        | Updated     | Notes |
| --- | ------------------------------------------------------- | ------------- | ----------- | ----- |
| 1.1 | Implement score quantisation and deterministic comparator| Completed     | 2025-09-28  | Shipped prior to this pass; quantiser/comparator live in `src/game/systems.ts`. |
| 1.2 | Build threat-weighted target prioritisation cache       | Completed     | 2025-09-28  | Blackboard priority queues and focus tracking already in place. |
| 1.3 | Add interrupt manager for reactive decisions            | Not Started   | 2025-09-28  | Tie into hp delta, VIP threat, and target loss hooks. |
| 1.4 | Expand vertical clamp per role                          | Not Started   | 2025-09-28  | Needs profile-driven clamp parameters and tests. |
| 1.5 | Extend diagnostics with tie/latency/focus data          | Not Started   | 2025-09-28  | Update metrics, harness logs, and dashboard consumers. |
| 1.6 | Tune scoring weights with threat/focus bias             | Not Started   | 2025-09-28  | Dependent on prior steps; adjust constants and tests. |

## Progress Log

### 2025-09-28

- Captured determinism-focused task with staged implementation plan derived from design memo.
- Documented requirements/design updates confirming score precision and target prioritisation are landed; queued interrupt/diagnostics/vertical scope for implementation.
