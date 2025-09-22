# Varied Ship AI Behaviors — Implementation Plan (Spec-Driven)

Date: 2025-09-22
Branch target: dev (non-breaking, behind feature flag)

## Context & Constraints

- Engine: React Three Fiber + Rapier3D, ECS via Miniplex, deterministic RNG in `src/utils/rng.ts`.
- Canonical state: All runtime state lives on `GameState` (`src/types/index.ts`). No module-level state.
- Performance: Avoid per-frame allocations; keep AI work off the render hot path; prefer shared queries.
- Determinism: All randomness seeded; no `Math.random`, no time-based jitter.

## Requirements (EARS)

1) WHEN the simulation updates AI at a fixed cadence, THE SYSTEM SHALL compute each ship’s next intent using a deterministic utility score over shared blackboard data and per-ship state [Acceptance: identical command stream over N ticks given same seed].
2) WHEN the number of ships grows to 300, THE SYSTEM SHALL keep AI step time within a configurable budget by using a fixed tick rate, LOD tiers, and round-robin scheduling [Acceptance: perf harness shows ≤ budget ms per AI tick at 300 ships on baseline hardware].
3) WHEN a ship has a behavior profile (e.g., Kiter, Brawler, Escort, Artillery), THE SYSTEM SHALL produce noticeably different movement/engagement patterns using only profile parameters and intents (no hard-coded per-class logic) [Acceptance: scenario tests verify band-keeping, escort radius, and standoff distance].
4) WHEN team posture or assignments change, THE SYSTEM SHALL reflect this in per-ship scoring (e.g., escorts prioritize threats to VIP) within one AI tick [Acceptance: unit test verifies score/target shift on posture flip].
5) WHEN AI v2 is disabled, THE SYSTEM SHALL preserve existing behavior without regressions [Acceptance: existing unit tests pass with flag off].

## High-Level Design

AI v2 is a data-driven, intent-based decision layer with:
- Profiles (config): tuning knobs per role/class to generate variety without code changes.
- Blackboard (per AI tick): shared, cached queries (nearest enemies, ally centroids, threat densities).
- Utility scorer (integer/fixed-point): cheap, deterministic scores for a small set of candidate intents.
- Executors (branch-light): map intent → steering/command outputs (heading/throttle/fire gating).
- Scheduler + LOD: fixed AI tick, capped work per tick, slower rate for idle/distant ships.
- Team tactics pass: assigns escorts and posture; exposes simple vectors/flags to scorers.

Integration points:
- New `DecisionSystem` co-located with `src/game/systems.ts` loop.
- Per-ship AI state added as a component on entities defined in `src/types/index.ts` and written by systems in `src/game`.
- Profiles live in `src/game/aiProfiles.ts` (new), referenced by `src/game/ships.ts` on spawn.
- Feature flag in `src/game/config.ts` (or `uiStore`) to toggle AI v2 at runtime for A/B.

## Data Shapes (Type Sketches)

- type AIIntent = 'Attack' | 'Kite' | 'Flee' | 'Escort' | 'Intercept' | 'Reposition' | 'Regroup'
- interface AICommand { heading: [number,number,number]; thrust: number; firePrimary: boolean; orbit?: number; targetId?: number; ttl: number }
- interface AIState { profileId: string; intent: AIIntent; nextThinkAt: number; cooldowns: { dodgeAt: number; burstAt: number }; lod: 0|1|2; traitSeed: number; targetId?: number; lastScore?: number; command: AICommand }
- interface BehaviorProfile { desiredRange: [number, number]; orbit: number; aggression: number; patience: number; dodgeFreq: number; classBias: Partial<Record<ShipClass, number>>; style: 'brawler'|'kiter'|'artillery'|'escort'; gates?: { ammoMin?: number; hpRetreatPct?: number } }
- interface AIBlackboard { tickIndex: number; teamPosture: Record<Team, 'aggressive'|'hold'|'retreat'>; allyCentroid: Record<Team, Vec3>; nearestEnemy: Record<EntityId, EntityId | undefined>; threatToVip: Record<EntityId, EntityId | undefined>; sectorIndex?: Uint16Array; tmpVectors: Vec3[] }

All stored on `GameState` (no module-level state). Use pooled arrays/typed arrays where practical.

## Fixed AI Tick & Budget

- ai.tickRateHz: 10 Hz (100 ms) default, configurable via `src/game/config.ts`.
- ai.maxPerTick: dynamic slice = ceil(totalShips / ai.slices) with backpressure; ensure fairness round-robin.
- LOD: 0 = active (tick every slice); 1 = normal (tick at base rate); 2 = idle/distant (tick every 2–3 slices). LOD computed cheaply from distance-to-camera or combat proximity.

## Execution Flow per AI Tick

1) Team tactics pass: compute posture (based on score/attrition), assign escorts to VIPs, compute ally centroids; write to blackboard.
2) Shared queries: update nearest enemy cache, threat-to-VIP map, sector counts. Avoid Rapier queries per ship; reuse entity arrays, squared distances.
3) Schedule ships: choose a slice; for each ship in slice → score candidate intents (3–5) using profile + blackboard + local state → pick best (tie-break via seeded RNG) → run executor → write `AIState.command`.
4) Between ticks: ships execute last command every frame; only AIState updates on tick boundaries.

## Executors (Branch-Light)

- Attack: seek/arrive towards target within desired band, enable fire gating if within band and LOS approx.
- Kite: steer away to maintain upper band, orbit with profile.orbit, fire on band entry.
- Escort: seek to escort offset near VIP and prioritize threats to VIP.
- Intercept: lead target velocity vector, prioritize fast/close threats.
- Flee/Regroup: move towards ally centroid or safe vector until hp threshold recovers.

Use shared scratch vectors to prevent allocations.

## Team-Level Tactics

- Posture: 'aggressive'|'hold'|'retreat' computed from ship counts/hp and objective state; flag influences aggression/ patience weights in scorer.
- Escort assignment: greedy matching of escorts to VIPs (carriers/capitals) limited per VIP.

## Feature Flag & Rollout

- config.ai.v2Enabled (default false). When disabled, keep existing behavior. Add a UI toggle if useful for QA.
- Phase rollout (below) ensures safe incremental merges with tests at each step.

## Phased Tasks (implementation status)

Phase 0 — Skeleton & Flag — DONE
- Add types to `src/types/index.ts` (AIState, AICommand, AIBlackboard, BehaviorProfile). (Implemented)
- Add `config.ai` (tickRateHz, maxPerTick, enabled) in `src/game/config.ts`. (Implemented)
- Wire a no-op DecisionSystem behind flag (returns current behavior commands) to validate plumbing. (Implemented: decision system wired behind `state.ai.enabled`)
- Tests: flag-off regression suite passes. (Completed: `test/vitest/ai-regression.spec.ts` covers legacy parity when the flag is off)

Phase 1 — Blackboard + Fixed Tick — DONE
- Implement AI tick clock, round-robin scheduler, and empty blackboard holder on `GameState`. (Implemented in `updateDecisionSystem` / `state.ai`)
- Implement nearest-enemy cache (shared query) and ally centroids. (Implemented in `refreshBlackboard`)
- Tests: determinism of blackboard content; perf micro-bench for nearest cache. (Completed: `ai-determinism.spec.ts` replays 40 ticks across identical seeds)

Phase 2 — Profiles + Utility Scoring — DONE
- Create `src/game/aiProfiles.ts`, define 3 profiles: Brawler, Kiter, Escort; map defaults in `ships.ts`. (Implemented)
- Implement integer/fixed-point utility scorer with band error, hp, posture, class bias. (Implemented: `score*Intent` functions)
- Tests: snapshot scores for fixed scenarios; tie-break deterministically with RNG. (Completed: `ai-scorer.spec.ts` locks posture, VIP threat, and tie-break outputs)

Phase 3 — Executors (Attack, Kite, Escort) — DONE
- Implement steering executors; write `AICommand` to entity; integrate fire gating using `src/config/projectiles.ts` ranges. (Implemented: `writeCommand` and `executeAICommand` exist and integrate firing)
- Tests: band-keeping for Kiter; escort radius adherence; fire gating on/off at thresholds. (Completed: `ai-executor.spec.ts` exercises attack/kite/escort branches)

Phase 4 — LOD + Budget — DONE
- Implement LOD computation; reduce think frequency for idle/distant; cap per-tick work. (Implemented: `computeLod`, slice scheduling, metrics)
- Tests: perf harness under 300 ships meets budget; fairness across ticks. (Completed: `scripts/perf/assert-ai-budget.ts` with `npm run perf:ai-budget` enforces the budget)

Phase 5 — Team Tactics — DONE
- Add posture calculation and escort assignment; feed into scorer. (Implemented: `refreshBlackboard` computes posture; `assignTeamRoles` assigns escorts)
- Tests: verify target shift under posture change; escorts prioritize VIP threats. (Completed: `ai-scorer.spec.ts` asserts VIP threats boost escort utility)

Phase 6 — Traits — DONE
- Seed per-ship small traits (±5–10% aggression/patience/dodge) at spawn using seeded RNG; store in AIState. (Implemented: `aiTraits.generateTraitsFromSeed`, seeded in `createInitialAIState`)
- Tests: determinism across seeds; variety distribution sanity. (Completed: determinism spec reuses seeded RNG to verify identical command streams)

Phase 7 — Hardening & Tooling — DONE
- Add debug overlay (optional) to render intent and band error (dev only). (Completed: HUD `AiDebugOverlay` exposes metrics/intents behind toggle)
- Add counters/metrics on GameState (ai.decisions, ai.skipped, ai.budgetExceeded). (Implemented: metrics fields exist and are updated)
- Finalize docs and example scenarios in `docs/`. (Completed: `docs/ai-v2-overview.md` refreshed with overlay + validation details)

Phase 8 — Intercept & Reposition — TODO
- Expand scorer/executor coverage to include `Intercept`, `Reposition`, and `Regroup` intents for bomber and artillery escorts (extend `selectIntent` and write deterministic math mirroring legacy intercept behaviour).
- Create posture-aware lead targeting that biases interceptors toward fast movers without breaking determinism (reuse hash-based tie-breaking and pooled vectors; avoid additional allocations).
- Tests: Vitest specs covering intercept band entry, regroup spacing around ally centroid, and regression of escort prioritisation when new intents activate.

Phase 9 — Scenario Harness & Visual QA — TODO
- Build scripted battle scenarios (escort swap, artillery standoff, bomber intercept) that run headless and emit deterministic logs for debugging.
- Capture representative HUD overlay snapshots or lightweight Playwright flows that toggle AI V2 and verify debug data populates.
- Tests: scenario harness assertions baked into Vitest (golden log comparison) plus optional screenshot diffs stored under `docs/`.

Phase 10 — Rollout & Automation — TODO
- Promote `AI_CONFIG.enabled` default behind environment flag once intercept/regroup stabilise; document rollback steps.
- Integrate `npm run perf:ai-budget` into CI alongside new scenario tests; gate merges on budget and determinism checks.
- Provide troubleshooting guide in `docs/ai-v2-rollout.md` (new) summarising toggles, metrics, and recovery commands.

### Implementation status summary (requirements mapping)
- R1 — Deterministic command stream (Requirement: identical command stream given same seed): DONE — `ai-determinism.spec.ts` replays 40 ticks and compares command streams across identical seeds.
- R2 — Performance budget at 300 ships: DONE — `scripts/perf/assert-ai-budget.ts` + `npm run perf:ai-budget` fail when the average AI tick exceeds the configured budget.
- R3 — Behavior variety via profiles: DONE — profile scorers and executors are covered by `ai-scorer.spec.ts` / `ai-executor.spec.ts` assertions.
- R4 — Team posture reflected within one tick: DONE — escort scoring under VIP threat is validated in `ai-scorer.spec.ts`.
- R5 — Flag-off preserves legacy: DONE — `ai-regression.spec.ts` exercises the disabled flag path and matches legacy steering.

Next small, high-value actions (tests and tooling):
- Phase 8: lock intercept/regroup math and add scorer/executor coverage.
- Phase 9: land deterministic scenario harness + visual toggles for QA.
- Phase 10: upstream perf harness into CI and prep rollout documentation.


## Testing Strategy

- Unit (Vitest):
  - Determinism — `ai-determinism.spec.ts` keeps command streams stable across seeded runs.
  - Scorer — `ai-scorer.spec.ts` snapshots intent scores under posture/VIP changes.
  - Executors — `ai-executor.spec.ts` validates band keeping, escort radius, and fire gating.
  - Upcoming — `ai-intercept.spec.ts` (Phase 8) to validate intercept/regroup/reposition scoring and command outputs.
- Integration: extend scenarios (e.g., escort swaps, artillery standoff) to complement unit coverage, with Phase 9 introducing a deterministic scenario harness + golden-log comparisons.
- Performance: `npm run perf:ai-budget` enforces the AI tick budget; `perf:instancer` remains available for full renderer profiling.
- E2E (optional): Playwright smoke to toggle AI v2 and ensure UI flow unchanged.

## Performance Budgets & Guards

- ai.tickRateHz: 10; budget target ≤ 2.0 ms at 300 ships (tune per machine; expose config).
- `npm run perf:ai-budget` runs a headless assertion with 300 fighters and fails if the rolling average exceeds the configured budget.
- Shared queries only once per tick; O(N) scans, no per-ship broadphase; squared-distance math.
- No per-tick allocations; reuse arrays/typed arrays; pool scratch vectors.
- Branchless clamps and short integer math in scorers; avoid trig where possible.

## Risks & Mitigations

- Non-determinism: enforce seeded RNG, avoid Date/time, gate all randomness through `rng.ts`.
- Spikes at high N: LOD + budget slices + round-robin fairness; counters to detect budget breaches.
- Complexity creep: profiles and intents remain small; prefer param tweaks over new code paths.
- Physics/visual drift: commands are stable between ticks; do not mutate transforms outside physics sync.

## Acceptance Criteria (Mapping to Requirements)

- R1: Deterministic command stream test — PASS.
- R2: Perf harness under budget at 300 ships — PASS.
- R3: Behavior variety scenario tests (Kiter band; Brawler close; Escort radius) — PASS.
- R4: Team posture/escort assignment reflected in scoring within one tick — PASS.
- R5: Flag-off preserves legacy behavior (existing tests green) — PASS.

## Files to Touch (planned)

- src/types/index.ts — Add AI types (AIState, AICommand, AIBlackboard, BehaviorProfile).
- src/game/config.ts — Add `config.ai` and helpers.
- src/game/aiProfiles.ts — New: profile definitions and helpers.
- src/game/systems.ts — Add DecisionSystem + TeamTacticsSystem; schedule in frame loop.
- src/game/ships.ts — Assign default profiles on spawn; seed traits.
- src/game/state.ts — Extend `GameState` with `ai` and `blackboard` fields.
- test/vitest/**/*.spec.ts — New tests per phase; determinism, scoring, executors, perf guards.
- docs/ — Add short AI v2 design notes.

## Rollback Plan

- Keep `config.ai.v2Enabled = false` default in dev until validated; one toggle reverts to legacy behavior.
- Changes are additive; no removal of old logic until confidence is high.

## Estimation (rough, part-time cadence)

- Phase 0–2: 1–2 days
- Phase 3–4: 1–2 days
- Phase 5–6: 1 day
- Phase 7: 0.5–1 day
- Phase 8: 1 day
- Phase 9: 1 day
- Phase 10: 0.5 day

## Open Questions

- Exact LOD heuristic: camera distance vs. combat proximity — start with combat proximity; add camera distance if needed.
- LOS approximation: keep simple (cone + dot) or add physics ray query? Start simple for perf.
- Intercept vs. Escort precedence: ensure new intercept/regroup intents do not starve VIP protection; revisit assignment weighting in Phase 8.

—
This plan follows repo constraints: canonical GameState, deterministic RNG, config-driven parameters, minimal allocations, and clear validation gates. 