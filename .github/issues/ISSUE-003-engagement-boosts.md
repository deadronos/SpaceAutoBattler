# Engagement boosts, band stickiness and opening-salvo posture (Stage 3)

Labels: enhancement, ai, perf

## Summary

Reduce AI passivity by adding small score nudges and temporary posture overrides to increase engagements, especially during the opening salvo. Also add band stickiness to prevent frequent toggling between bands.

## Target files

- `src/game/systems.ts` (scoring & posture logic changes)
- `src/game/aiProfiles.ts` (engagementBias, bandStickiness)

## Implementation steps

1. Add `engagementBias` to `BehaviorProfile` for role-based score nudges.
2. Add `openingSalvoDuration` config (default 3s) and `openingSalvoAggressionBoost` multiplier.
3. Implement band stickiness: when a ship selects a band, lock for 2-4s before re-evaluating. Use seeded RNG for randomization.
4. Add unit tests to assert that ships remain in-band for the stickiness window and that opening-salvo increases attack posture rates.

## Acceptance criteria

- Attack posture percentage increases by 12% in the first 10s of seeded matches.
- Band toggle events per ship drop by 50% (reduce oscillation).

## Risk & rollback

- Risk: Over-aggressive nudges may unbalance combat. Roll back values or disable `engagementBoostEnabled` flag.

## Notes

This is Stage 3 in `plan/plan-ai-improvement-v0.1.1.md`.
