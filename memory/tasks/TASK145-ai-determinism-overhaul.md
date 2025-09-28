# TASK145 - Implement AI Determinism & Coordination Overhaul

**Status:** Completed
**Added:** 2025-09-28
**Updated:** 2025-09-30

## Original Request

Execute the AI decision determinism and coordination improvements captured in `memory/design-ai-determinism-v0.1.1.md`, ensuring documentation-driven development with traceable requirements, comprehensive testing, and progress tracking via the Memory Bank.

## Thought Process

The existing AI decision pipeline suffers from coarse score quantisation, non-deterministic tie resolution, distance-biased targeting, sluggish reaction to critical events, constrained vertical manoeuvres, and limited telemetry. Addressing these issues requires coordinated updates across scoring helpers, target blackboard, scheduler interrupts, heading execution, configuration constants, and diagnostics. Work must remain deterministic (seeded RNG only as last resort) and align with the canonical `GameState` and scheduler infrastructure. We must stage the effort to secure determinism first, then layering prioritisation, responsiveness, vertical tuning, and diagnostics while keeping performance and KPI stability in check.

## Implementation Plan

- [x] **Score precision & comparator (P0):** Quantise scores to 0.1 resolution, replace `Math.floor` usage, implement comparator ordering (intent rank → threat rank → distance → ship index), and instrument tie metrics.
- [x] **Target prioritisation (P0):** Extend blackboard caches with threat-weighted ordering and focus-fire tracking; update intent selection to prefer highest threat targets with deterministic ordering.
- [x] **Interrupt responsiveness (P0):** Introduce interrupt manager tracking HP drops, VIP threats, and target loss; ensure `nextThinkAt` snaps to the current tick and record latency metrics.
  - Drafted event flow (hp-drop, vip-threat, target-lost) with per-ship cooldown guardrails and latency histogram buckets (2025-09-29).
  - Identified touch points in `AIManagerState.interrupts`, `resolveDamageEvents`, and harness updates for `test/vitest/ai-interrupts.spec.ts`.
- [x] **Vertical clamp expansion (P1):** Parameterise heading Y clamp by profile role and band error; expand range for agile hulls while preserving deterministic behaviour.
- [x] **Diagnostics expansion (P1):** Extend metrics payload with tie count, comparator fallbacks, decision latency histogram, focus-fire ratios, and vertical amplitude distribution; update harness serialization and consumer tooling.
- [x] **Scoring enrichment & tuning (P1/P2):** Integrate threat/focus weighting into intent scores, rebalance constants, and validate KPI/telemetry baselines; retain toggles for incremental rollout.

## Error Handling Matrix (Draft)

| Failure Mode | Detection | Response | Follow-up |
| --- | --- | --- | --- |
| Interrupt thrash from repeated HP drops | Track cumulative HP delta per ship and throttle to one interrupt per tick | Queue excess events for next tick and log `ai.interrupt.throttle` metric | Tune cooldown threshold once latency telemetry is collected |
| Empty or stale target cache | Blackboard rebuild observes zero valid entries or stale tick | Rehydrate from nearest-enemy fallback and flag `ai.targetcache.rebuild` warning | Add regression to ensure caches refresh after entity despawn |
| Score comparator fed invalid data | Guard assertions detect `NaN` or missing threat rank | Fall back to prior deterministic ordering and emit structured warning | Extend diagnostics snapshot with offending ship/intent payload |
| Metrics histogram overflow | Sample array length > 256 entries | Drop oldest samples before push and increment `ai.metrics.trimmed` counter | Review bucket sizing after first full scenario replay |

## Progress Tracking

**Overall Status:** Completed - 100%

### Subtasks

| ID  | Description                                             | Status        | Updated     | Notes |
| --- | ------------------------------------------------------- | ------------- | ----------- | ----- |
| 1.1 | Implement score quantisation and deterministic comparator| Completed     | 2025-09-28  | Shipped prior to this pass; quantiser/comparator live in `src/game/systems.ts`. |
| 1.2 | Build threat-weighted target prioritisation cache       | Completed     | 2025-09-28  | Blackboard priority queues and focus tracking already in place. |
| 1.3 | Add interrupt manager for reactive decisions            | Completed     | 2025-09-30  | Interrupt queue snaps `nextThinkAt`, latency buckets covered by new Vitest spec. |
| 1.4 | Expand vertical clamp per role                          | Completed     | 2025-09-30  | Added role-aware clamps plus heading dispersion coverage in `ai-vertical` spec. |
| 1.5 | Extend diagnostics with tie/latency/focus data          | Completed     | 2025-09-30  | Harness metrics expose decision latency, focus fire, heading amplitude, and ties. |
| 1.6 | Tune scoring weights with threat/focus bias             | Completed     | 2025-09-30  | Threat/focus weighting stabilised with deterministic scoring snapshots and fixtures. |

## Progress Log

### 2025-09-30

- Implemented interrupt queue flow end-to-end with `ai-interrupts` regression spec capturing latency bucket resets.
- Added vertical clamp verification for agile vs heavy hulls and expanded heading amplitude sampling diagnostics.
- Extended scenario harness metrics API to surface decision latency, focus fire, heading amplitude, and tie ratios for external tooling.

### 2025-09-28

- Captured determinism-focused task with staged implementation plan derived from design memo.
- Documented requirements/design updates confirming score precision and target prioritisation are landed; queued interrupt/diagnostics/vertical scope for implementation.
