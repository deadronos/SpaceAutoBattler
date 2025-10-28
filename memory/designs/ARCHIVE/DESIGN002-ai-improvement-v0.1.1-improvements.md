```markdown
# Design Improvements — AI Improvement v0.1.1

**Status:** Draft 2025-09-28  
**Related Design:** memory/design-ai-improvement-v0.1.1.md

## Snapshot

- Compliance score from 2025-09-27 review: **88%** (core behavior in place;
  validation gaps remain).
- Strengths: KPI instrumentation, per-hull telemetry, and AiDebug overlay
  summaries are already landed and stable.
- Determinism gaps: Scenario harness logs for seeds {777, 2029, 4041} show
  frequent ties among top intents because scores are floored to integers,
  forcing `tieBreak` to select via seeded hash.
- Responsiveness: LOD-driven think spacing (1/2/4 ticks) plus band stickiness
  (3 s) delays reactions to fresh threats and posture flips.
- Targeting: Blackboard `nearestEnemy` overrides profile class bias, preventing
  coordinated focus fire or threat-based prioritisation.
- Vertical control: `applyVerticalPerturbation` relies on small RNG jitters and
  clamps `heading.y` to ±0.3, yielding almost planar engagements.

## Improvement Areas

### 1. Score Resolution & Tie Determinism

- **Gap:** `score*Intent` helpers use `Math.floor`, collapsing minor
  differences and inflating tie frequency; `tieBreak` still provides
  deterministic but seed-sensitive picks.
- **Actions:**
  - Prototype higher-resolution scores (retain floats or scale before
    flooring) and compare tie counts across harness seeds; capture results in
    telemetry.
  - Introduce a deterministic secondary comparator (e.g., intent priority,
    target hp delta, distance) before falling back to seeded randomness.
  - Extend diagnostics to emit per-intent tie histograms so regression tests
    can assert tie frequency thresholds.

### 2. Intent Scoring Enrichment

- **Gap:** Current weights emphasise band error and fixture-preserving
  constants, underweighting target lethality, ship hp risk, and team posture
  context.
- **Actions:**
  - Revisit `scoreAttackIntent`, `scoreInterceptIntent`, `scoreKiteIntent`,
    and `scoreFleeIntent` to incorporate target hp, ally focus fire, and ship
    hp gating.
  - Model separate coefficients for hull archetypes (e.g., artillery vs.
    brawler) and ensure they remain differentiable after any score scaling.
  - Validate new weights against seeded fixtures and update KPI baselines once
    variance stabilises.

### 3. Target Prioritisation & Team Coordination

- **Gap:** `refreshBlackboard` maps each ship to the closest opponent,
  ignoring profile `classBias`, threat levels, or shared objectives; escorts
  provide the only team-level coordination.
- **Actions:**
  - Replace nearest-only lookup with a weighted priority list that factors
    hull class, threat-to-VIP markers, hp, and current focus fire counts.
  - Persist a team-level focus fire table on the blackboard so multiple ships
    can converge on high-value targets without manual escort roles.
  - Add playbook hooks for formation or flanking patterns once priority
    assignment infrastructure is in place.

### 4. Responsiveness & Stickiness Controls

- **Gap:** `computeLod` and the per-LOD `nextThinkAt` spacing, combined with
  three-second band stickiness, cause ships to hold headings despite new
  hazards.
- **Actions:**
  - Allow critical interrupts (new threat, hp drop, VIP call) to reset
    stickiness and force immediate reevaluation regardless of LOD.
  - Tune `AI_CONFIG.bandStickinessDuration` dynamically per profile/posture,
    and expose it to telemetry for live profiling.
  - Audit slice budgeting to ensure large fleets still receive timely intent
    updates when interrupts fire.

### 5. Vertical Maneuver Strategy

- **Gap:** Vertical offsets use small Gaussian jitters plus modest preference
  nudges, all clamped to ±0.3, limiting altitude play.
- **Actions:**
  - Experiment with profile-aware amplitude scaling and context signals
    (incoming fire vector, obstacle proximity) before clamping.
  - Evaluate introducing an explicit vertical intent or modifier that can
    request high-elevation escape or dive maneuvers.
  - Feed vertical delta metrics (already logged via `recordShotMetrics`) into
    acceptance criteria so elevation adjustments remain measurable.

### 6. Validation & Diagnostics Evolution

- **Gap:** Existing metrics focus on KPI compliance but do not assert tie
  frequency, target focus consistency, or responsiveness latency.
- **Actions:**
  - Extend Vitest harnesses to assert maximum acceptable tie counts, decision
    latency (ticks between threat change and intent swap), and focus fire
    ratios.
  - Capture deterministic snapshots for revised target selection and
    responsiveness cases to guard against regression.
  - Document new telemetry channels and acceptance thresholds in
    `memory/requirements.md` and ensure AiDebug overlay surfaces tie/latency
    alerts.

## Suggested Test Coverage

- `test/ai-determinism.spec.ts`: verify score scaling reduces tie frequency and
  that secondary comparators pick stable intents.
- `test/ai-intent-weighting.spec.ts`: assert revised scoring reacts to target
  hp, ally hp, and posture changes.
- `test/ai-target-priority.spec.ts`: seed scenarios to confirm focus fire
  assignments and threat-driven prioritisation.
- `test/ai-responsiveness.spec.ts`: measure ticks between major threat events
  and intent updates across LOD levels.
- `test/ai-vertical.spec.ts`: validate expanded vertical manoeuvre amplitudes,
  clamps, and resulting Δy distributions.

## Sequencing Recommendations

1. **P0:** Address score resolution and tie determinism (Areas 1 and 6) to
   stabilise seeded fixtures and unblock downstream tuning.
2. **P1:** Rework intent weights and targeting coordination (Areas 2 and 3)
   once deterministic baselines are reliable.
3. **P2:** Refine responsiveness controls and vertical strategy (Areas 4 and 5)
   with telemetry-driven iteration.

## Risks if Deferred

- Seed-sensitive tie-breaks will continue to produce divergent outcomes,
  eroding confidence in KPI compliance and scenario fixtures.
- Brittle scoring will mask genuine tactical errors, leading to poor target
  selection and inconsistent fleet behaviour.
- Slow responsiveness and limited vertical play will leave VIPs vulnerable and
  reduce the tactical diversity promised for v0.1.1.

```
