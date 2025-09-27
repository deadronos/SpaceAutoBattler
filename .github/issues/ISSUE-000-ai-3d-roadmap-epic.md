# AI 3D Combat Roadmap (Epic)

Labels: epic, ai, enhancement

## Summary

This epic groups the staged work to restore and improve 3D combat usage, increase AI engagement, and address range compression. It references the stage issues that contain actionable tasks and test criteria.

Related stage issues

- ISSUE-001 - Enable 3D combat: spawn geometry & cadence (Stage 1)
- ISSUE-002 - 3D execution injection: heading perturbation & profile tuning (Stage 2)
- ISSUE-003 - Engagement boosts, band stickiness and opening-salvo posture (Stage 3)
- ISSUE-004 - Metrics harness and deterministic tests for AI experiments
- ISSUE-005 - Range compression: address engagement distances and projectile scaling
- ISSUE-006 - Rollout, feature flags, and monitoring

## Milestone: AI 3D Combat v0.1.1-experiments

Goal: Validate that enabling 3D maneuvers and modest engagement/range policy changes increases vertical use and engagement without regressing key balance metrics.

Checklist (workload order)

1. Stage 1 — Geometry & Cadence
   - [ ] Implement `spawn.verticalSpreadFactor`, anchor Y randomization, and `initialSeparationFactor` (see ISSUE-001)
   - [ ] Add `AI_CONFIG.tickRateHzExperiment` flag and set default to 15Hz behind flag
   - [ ] Tests: deterministic spawn Y offsets and seeded scenario time-to-first-shot

2. Stage 2 — 3D Execution Injection
   - [ ] Extend `BehaviorProfile` with `verticalManeuver`, `elevationPreference`, and `bandPreference` (see ISSUE-002)
   - [ ] Implement post-intent heading.y perturbation (seeded) and `headingYClamp` (default ±0.3)
   - [ ] Tests: heading Y deviation assertions and vertical dispersion histograms

3. Stage 3 — Engagement Boosts
   - [ ] Add `engagementBias`, `openingSalvoDuration`, and band stickiness (see ISSUE-003)
   - [ ] Tests: attack posture % increase and fewer band toggles

4. Metrics & CI
   - [ ] Add `test/vitest/ai-metrics.spec.ts` and test sink (see ISSUE-004)
   - [ ] Add CI job to run metrics harness and validate acceptance thresholds

5. Range Policy Experiments
   - [ ] Add `AI_CONFIG.rangePolicy` and implement `v0.1.1-exp` weapon/velocity micro-tuning (see ISSUE-005)
   - [ ] Tests: range histogram IQR increase and balance smoke checks

6. Rollout & Monitoring
   - [ ] Add flags to `src/game/config.ts` and document toggles (see ISSUE-006)
   - [ ] Expose dev toggles (query param or env) and ensure metrics are reported for each experiment

## Acceptance Criteria (expanded)

- Vertical dispersion (median |Δy|) > 200 units in seeded runs (p50) when `verticalEnabled` is true.
- Time-to-first-shot (p50) reduces by ≥10% in 15v15 seeded scenarios after Stage 1.
- Attack posture percentage increases by ≥12% in the first 10s after Stage 3.
- Range histogram IQR increases by ≥15% under `rangePolicy=v0.1.1-exp`.
- No more than 5% regression in overall match duration and win-rate metrics for default compositions in seeded smoke tests.

## Rollback strategy

- All behavioral changes MUST be gateable via flags in `src/game/config.ts`. Revert experiments by toggling flags and/or gradually reducing effect sizes.
- If CPU usage increases >15% in 15v15 profiles, rollback tickRate changes first.

## Monitoring & telemetry

- Use the metrics harness (ISSUE-004) to capture acceptance metrics and report via CI job artifacts.
- Add a short-form summary to `playwright-report/` or `test-results/` for visual verification runs.

## Notes

Start small: Stage 1 + lightweight tests give the fastest feedback. Keep high-ground mechanical modifiers for follow-up only after behavioral validation.
