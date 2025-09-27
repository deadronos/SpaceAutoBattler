# Design Improvements — AI Improvement v0.1.1

**Status:** Draft 2025-09-28  
**Related Design:** memory/design-ai-improvement-v0.1.1.md

## Snapshot

- Compliance score from 2025-09-27 review: **88%** (core behavior in place; validation gaps remain).
- Strengths: vertical execution, range policy adjustments, escort shell distribution, spawn geometry, and configuration toggles all ship-ready.
- Attention areas: acceptance metrics, deterministic validation harness, telemetry breadth, and minor performance hardening.

## Improvement Areas

### 1. Acceptance Metrics & Aggregation

- **Gap:** The design requires KPIs such as time-to-first-shot (p50 ≤ 20s, p90 ≤ 30s), opening Attack/Intercept share ≥ 60%, and role-specific in-band adherence. Current code only records raw counters (`openingAggressiveIntents`, `verticalSamples`, `inBandSamples`).
- **Actions:**
  - Extend `AIMetrics` with accumulator fields for first-shot timestamps, intent timelines, and per-hull shot distance histograms.
  - Add lightweight aggregators that compute desired percentiles and percentages at deterministic checkpoints (e.g., end-of-sim or 30s window).
  - Expose aggregation results via debug logging or structured telemetry for automated gating.

### 2. Deterministic Validation Harness

- **Gap:** No automated acceptance tests assert the new KPIs under seeded scenarios.
- **Actions:**
  - Author Vitest suites exercising seeded battles (e.g., 15v15 baseline) validating KPI thresholds.
  - Add targeted unit specs for `applyVerticalPerturbation`, opening salvo scoring, escort shell assignments, and range policy adjustments.
  - Integrate tests into CI gate; document commands in README/testing guides.

### 3. Telemetry & Observability

- **Gap:** Missing instrumentation for vertical dispersion distribution, shot Δy histograms, per-hull in-band time, and first-shot timestamps.
- **Actions:**
  - Record `Δy` per fired shot and bucket by hull for elevation analysis.
  - Track time of first firing event per ship to support time-to-first-shot KPI.
  - Provide developer HUD hooks (optional) that visualise vertical spread, band adherence, and engagement posture.

### 4. Performance & Determinism Hardening

- **Gap:** Escort shell offset calculations and RNG instantiation allocate per call; physics determinism hinges on consistent RNG usage.
- **Actions:**
  - Reuse temp vectors/RNG instances (or derive deterministic jitters without instantiating new RNG objects) in decision hot paths.
  - Audit any unseeded randomness; ensure all AI-time RNG flows originate from `state.rng` or `SeededRng` seeded with explicit values.
  - Profile 15v15 (AI tick 15 Hz) to confirm decision budget stays within target slices.

### 5. Documentation & Decision Artifacts

- **Gap:** Acceptance metric definitions and validation workflow are not yet captured in shared docs.
- **Actions:**
  - Update `memory/requirements.md` and the design doc with finalized metric formulas.
  - Record a decision log entry once KPI implementation stabilizes (noting any compromises or tuning knobs).
  - Add developer onboarding notes covering the new telemetry and test commands.

## Suggested Test Coverage

- `test/ai-vertical.spec.ts`: seeded perturbation expectations per role; clamp behavior.
- `test/ai-engagement.spec.ts`: opening salvo intent share and range-policy scoring nudges.
- `test/spawn-geometry.spec.ts`: initial fleet separation, vertical spread, deterministic anchor Y offsets.
- `test/ai-3d-combat.spec.ts`: full-battle KPI assertions (time-to-first-shot, in-band %, vertical Δy distribution).

## Sequencing Recommendations

1. **P0:** Implement KPI instrumentation/aggregation and acceptance tests (blocks validation).
2. **P1:** Performance/determinism hardening and telemetry visualization hooks.
3. **P2:** Documentation refresh and optional HUD overlays.

## Risks if Deferred

- KPI gaps make it difficult to prove the feature meets design intents; regression detection weak.
- Lack of deterministic tests increases risk of future tuning drift and nondeterministic replay failures.
- Extra allocations in AI decision code could strain performance at higher fleet counts when combined with 15 Hz ticks.
