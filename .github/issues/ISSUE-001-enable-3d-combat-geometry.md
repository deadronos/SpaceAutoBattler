
# Enable 3D combat: spawn geometry & cadence (Stage 1)

Labels: enhancement, ai, spike

## Summary

The game code supports 3D movement but in-practice combat is biased toward the horizontal plane due to spawn geometry and AI cadence. This issue tracks implementing Stage 1 from `plan/plan-ai-improvement-v0.1.1.md` to ensure vertical space is used by combatants.

## Target files

- `src/game/state.ts` (spawn geometry)
- `src/game/config.ts` (AI_CONFIG.tickRateHz)

## Implementation steps

1. Add `spawn.verticalSpreadFactor` config (default 0.2) and use it when computing spawn Y offsets: `verticalSpread = WORLD_HALF * spawn.verticalSpreadFactor`.
2. Randomize team anchor Y when spawning teams (config `spawn.anchorYRandomization = true`).
3. Compute `initialSeparationFactor` (default 1.5) and ensure initial ships are at least separationFactor * maxWeaponRange apart.
4. Set `AI_CONFIG.tickRateHz = 15` behind a feature flag `AI_CONFIG.tickRateHzExperiment` to allow rollback.
5. Add unit tests to assert deterministic spawn Y offsets with the seeded RNG (e.g., seed=1337).

## Acceptance criteria

- Median vertical dispersion across battlefield > 200 units in seeded runs.
- Time-to-first-shot (p50) decreases by at least 10% in 15v15 seeded scenarios.

## Risk & rollback

- Risk: Increased spawn vertical range may cause large height separations that reduce early engagements. Rollback by reverting `spawn.verticalSpreadFactor` to 0.
- Risk: Tick rate changes increase CPU. Gate behind feature flag and profile at 15Hz with 15v15.

## Notes

See `plan/plan-ai-improvement-v0.1.1.md` for framing, EARS requirements and metrics.
