# Design — Ship Level Bonus Caps

**Summary:** Ensure ship progression respects configured stat caps by tracking cumulative level bonus multipliers and recalculating stats from their base values when a ship levels up.

## Goals

- Enforce the `LEVEL_BONUSES` caps for hull, shield, damage, shield regeneration, repair rate, and fire rate as ships gain levels.
- Preserve deterministic stat growth by deriving capped totals instead of compounding incremental percentages.
- Keep subsystem repair rates aligned with ship level bonuses without introducing new global state.
- Maintain compatibility with existing ship spawning, AI harness fixtures, and tests.

## Non-Goals

- Rebalancing the XP curve or level thresholds (`XP_CONFIG`).
- Changing captain traits, morale abilities, or subsystem damage logic.
- Introducing UI surfacing for progression statistics beyond existing hooks.

## Architecture Overview

- Extend `ShipComponent` with a `levelBonuses` object storing the aggregated multiplier applied to each capped stat (`hull`, `shield`, `damage`, `shieldRegen`, `repairRate`, `fireRate`).
- Initialise `levelBonuses` with zeroed multipliers in both `spawnShip` (runtime) and `createProgressionDefaults` (test helpers) so all entry points receive consistent state.
- Refactor `applyLevelUpBonuses` to:
  - Compute each target multiplier using `calculateLevelBonus`.
  - Recover the base stat by dividing the current stat by `(1 + previousBonus)`.
  - Apply the new capped multiplier to derive the updated stat and store the target multiplier back on `levelBonuses`.
  - Adjust `hp` by the delta between the new and previous `maxHp`, retaining the existing behavior of healing the ship when max hull increases.
- Apply the shared `repairRate` multiplier to every subsystem, recomputing from each subsystem’s base repair rate derived from the previous multiplier.
- Keep shield values deterministic by only adjusting `maxShield`, mirroring the current implementation that leaves live shields unchanged during level ups.

## Data Flow

1. A ship gains XP via `awardDamageXp` or `awardKillXp` until `checkLevelUp` detects `xp >= xpToNext`.
2. `checkLevelUp` increments `ship.level`, updates XP counters, and calls `applyLevelUpBonuses`.
3. `applyLevelUpBonuses` obtains capped totals per stat from `calculateLevelBonus`, recomputes stat baselines from recorded `levelBonuses`, applies the capped multipliers, and persists the totals in `levelBonuses`.
4. Subsystem repair rates are recalculated per subsystem using the shared repair bonus multiplier, maintaining deterministic repair throughput.
5. Subsequent level-ups repeat the cycle, but capped stats plateau once `calculateLevelBonus` reaches the configured limit.

## Interfaces

- **`ShipComponent.levelBonuses`**: `{ hull: number; shield: number; damage: number; shieldRegen: number; repairRate: number; fireRate: number; }`
  - Initialised to zeros, updated after each level up.
  - Represents the cumulative multiplier (e.g., `0.15` for +15%).
- **`RepairBonusState` (implicit)**: No separate type required; reuse `levelBonuses.repairRate` when adjusting subsystems.

## Data Models

- **Base Stat Recovery**: `baseValue = currentValue / (1 + previousBonus)` (guarding against division by zero for null stats).
- **Updated Stat**: `newValue = baseValue * (1 + cappedBonus)`.
- **Hit Point Adjustment**: `hp = min(hp + (newMaxHp - oldMaxHp), newMaxHp)` to keep current HP aligned with new maximum without overhealing beyond cap.

## Error Handling Matrix

| Scenario                                                        | Detection                                                | Response                                                                       | Notes                                                           |
| --------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| Division by zero when recovering base stats (e.g., fire rate 0) | Check `baseValue` before division                        | Treat base value as `0` and leave stat unchanged                               | Keeps zero-rated stats stable and avoids `Infinity`.            |
| Missing `levelBonuses` on legacy ship entity                    | TypeScript compile-time error; runtime fallback guard    | Initialise zeroed bonuses if absent (defensive guard in `applyLevelUpBonuses`) | Guard ensures backward compatibility with serialized states.    |
| Subsystem missing (malformed ship)                              | Existing iteration over `Object.values(ship.subsystems)` | Skip undefined entries                                                         | Behaviour unchanged from current implementation.                |
| Bonus cap misconfiguration (negative or NaN)                    | `calculateLevelBonus` would propagate invalid value      | Clamp to `Math.max(0, cap)` before use                                         | Maintains non-negative progression even if config is corrupted. |

## Testing Strategy

- Extend `test/vitest/progression-system.spec.ts` with scenarios that:
  - Level a ship to level 11 and assert hull, damage, shield regen, repair rates, and fire rate plateau at their caps.
  - Verify `hp` increases by the difference between new and previous `maxHp` while `maxShield` adjusts without exceeding cap.
  - Confirm leveling beyond the configured `maxLevel` for fire rate leaves `fireRate` unchanged.
- Add regression coverage ensuring subsystem repair rates stay within the capped multiplier and that ships starting at level 1 maintain base stats.
- Run `npm run typecheck` and `npm test` to exercise schema updates and the enriched progression spec.

## Open Questions

- None identified; the approach stays within existing progression architecture.
