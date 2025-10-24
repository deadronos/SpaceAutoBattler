# AI tuning notes — verticality, posture, and spawn tuning

This document summarizes recent analysis and recommended experiments to increase 3D variation in fights, diagnose why both fleets can "hold" (be overly cautious), and a roadmap of low-risk, reversible tuning steps. It references concrete fields and files in the codebase so changes are actionable and deterministic.

## Key findings

- AI V2 flattens commanded headings to the horizontal plane in the low-level steering: see `executeAICommand(...)` in `src/game/systems.ts` where the heading is forced to a yaw-only vector (Y component zeroed). Additionally `updateAngularMotion(...)` in `src/game/systems/motion.ts` projects headings to XZ when computing yaw.
- Spawns are not strictly 2D — `spawnInitialFleets` and `spawnRandomShip` (in `src/game/state.ts`) already sample Y from the seeded `SeededRng`, but the effective vertical spread is modest relative to `WORLD_SIZE`.
- Ship mobility tuning lives in `src/game/ships.ts` (`SHIP_STATS.<hull>.motion`) and AI behavior profiles in `src/game/aiProfiles.ts` (fields: `desiredRange`, `aggression`, `patience`, `orbit`, `dodgeFreq`).
- The world cube size and clamping are controlled by `WORLD_SIZE`/`WORLD_HALF` and `clampToWorld(...)` in `src/game/config.ts` (current `WORLD_SIZE = 4000`).

## Why both fleets "hold" (probable causes)

1. Initial posture is explicitly set to 'hold' on reset; AI must decide to change it. If decision thresholds or desired range logic are conservative, both sides remain in 'hold'.
2. AI tick budget or frequency: `AI_CONFIG.tickRateHz`, `maxPerTick`, and `slices` can cause slow or skipped decisions (check `ai.metrics` for `totalSkipped`/`budgetHits`).
3. Desired engagement distances vs spawn spacing: when `AI_PROFILES.*.desiredRange` is larger than actual spawn separation, ships prefer to hold rather than close.
4. Vertical behavior suppression: even when spawned with Y variance, V2 steering flattens heading (zero Y) — ships won’t visibly fly in altitude.
5. Ship mobility vs behavior profile: low speed or low aggression means ships will take longer to engage (fighters can be tuned to be faster/aggressive).

## Suggested experiments (priority order)

1. Instrument & measure (no behavior changes)

- Log `blackboard.teamPosture` transitions and `ai.metrics` values (totalDecisions, totalSkipped, budgetHits, lastDecisions) for several deterministic runs.

- Collect metrics: timeToFirstShot, timeToFirstDamage, mean engagement distance, heading.y distribution.

1. Low-risk visual verticality (fast)

- Option: preserve heading.y for linear movement while keeping rotation yaw-only. Implement behind `AI_CONFIG.allowVerticalMovement` toggle.

- Effect: ships will move vertically (3D crossing) with minimal control changes.

1. Tune AI profiles (quick, safe)

- Files/fields: `src/game/aiProfiles.ts` — modify `desiredRange`, `aggression`, and `patience` for profiles.

- Conservative deltas:

- Fighter/escort desiredRange `[90,180]` → `[70,150]`

- aggression +0.1 for brawler/escort

- patience -0.1 for brawler

1. Increase fighter mobility (medium)

- File/fields: `src/game/ships.ts` → `SHIP_STATS.fighter.motion.maxSpeed` and `linearAcceleration`.

- Example: maxSpeed 14 → 16 (+14%), linearAcceleration 28 → 34 (+20%).

1. Spawn spacing & vertical spread (medium)

- File: `src/game/state.ts`

- Changes:

- `baseSpacing`: try reducing to `WORLD_HALF * 0.08` to bring fleets closer.

- `anchorX`: reduce from `WORLD_HALF * 0.35` → `WORLD_HALF * 0.25`.

- `verticalSpread`: increase from `WORLD_HALF * 0.12` → `WORLD_HALF * 0.18` to increase altitude variance.

1. Increase AI reactivity (low risk)

- File: `src/game/config.ts` (AI_CONFIG)

- Changes: tickRateHz 10 → 12–15; increase `maxPerTick` if `ai.metrics.budgetHits` is high.

1. Consider world scaling (higher risk)

- `WORLD_SIZE` 4000 → 8000 expands playable volume but requires re-tuning of spawn radii, desiredRanges, camera/fog, and LOD thresholds.

## Metrics & acceptance criteria

- timeToFirstShot: target ≥30% reduction for aggressive tuning
- heading.y stddev: target ≥50% increase when enabling vertical movement
- teamPosture: should transition from 'hold' to an active posture within first 10s in tuned runs
- ai.metrics.totalSkipped and budgetHits: should be low; increase `maxPerTick` if budgetHits occur frequently

All experiments should be run deterministically (same SeededRng seed) for before/after comparison.

## Minimal rollback-safe change to try first

- Add `AI_CONFIG.allowVerticalMovement` boolean and, when true, skip the line that overwrites `heading.y = 0` in `executeAICommand`. This gives immediate visible altitude behavior while retaining yaw-only rotation and is reversible.

## Next steps

Pick 1–2 experiments to run. Recommended first sequence:

If you want, I can prepare the patch for any of the above (instrumentation, vertical toggle, AI/profile tweaks, spawn spacing) and run the deterministic tests. Confirm which experiments you want me to implement first, or say “I'll apply these manually” if you only wanted the plan.

---

Notes: all field and file references above are exact (search for the symbols `executeAICommand`, `spawnInitialFleets`, `SHIP_STATS`, `AI_PROFILES`, `WORLD_SIZE`, and `AI_CONFIG`). The repository uses a seeded RNG (`SeededRng`) so results are reproducible for test runs.
