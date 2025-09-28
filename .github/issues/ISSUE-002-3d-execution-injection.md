# 3D execution injection: heading perturbation & profile tuning (Stage 2)

Labels: enhancement, ai

## Summary

Inject controlled vertical maneuvers into AI execution step (post-intent) so intents remain semantically correct while ships act in 3D. This implements Stage 2 from `plan/plan-ai-improvement-v0.1.1.md`.

## Target files

- `src/game/aiProfiles.ts` (add `verticalManeuver`, `elevationPreference`, `bandPreference`)
- `src/game/systems.ts` (modify `executeAICommand`, add heading.y perturbation and clamp)
- `src/game/config.ts` (add `AI_CONFIG.verticalEnabled` and `headingYClamp` default ±0.3)

## Implementation steps

1. Add `verticalManeuver: number` (0.0–1.0) to `BehaviorProfile` with defaults per role (fighters: 0.5, corvette: 0.25, cruiser: 0.15, artillery: 0.05).
2. Add `elevationPreference: 'above' | 'below' | 'follow'` to profiles; artillery default `above`, fighters `follow`.
3. In `executeAICommand`, after computing the desired heading vector, apply a small vertical perturbation sampled deterministically from seeded RNG scaled by `verticalManeuver` and clamped to `headingYClamp`.
4. Add `AI_CONFIG.verticalEnabled` feature flag; gate the behavior and add a unit test to ensure no change when disabled.
5. Instrument `refreshBlackboard` to record vertical dispersion statistics for validation.

## Acceptance criteria

- Median per-ship heading Y deviation > 0.2 (role-weighted) in seeded tests when `verticalEnabled = true`.
- Vertical dispersion histogram shows non-trivial mass above/below center (median |Δy| > 200u).

## Risk & rollback

- Risk: Aggressive vertical perturbation may reduce hit rates for weapons with vertical aim limitations. Rollback by toggling `AI_CONFIG.verticalEnabled = false` or reducing `verticalManeuver` per role.
