# Design — Ship Progression System

## Overview

This design document outlines the ship progression system; the implementation now exists in `src/game/progression.ts` and configuration lives in `src/config/progression.ts`. Key features implemented include XP-based leveling, captain traits, subsystem mechanics, and progression-driven stat bonuses.

## EARS Requirements (implemented mapping)

The EARS requirements in this design map to implemented functions and constants:

1. XP and Leveling — implemented in `src/game/progression.ts` using `XP_CONFIG` (from `src/config/progression.ts`) and helpers `awardDamageXp`, `awardKillXp`, and `checkLevelUp`.
2. Level-up Progression — the `checkLevelUp` function recomputes and applies level bonuses using `LEVEL_BONUSES` and respects configured caps.
3. Captain System — captain creation and ability management are implemented via `generateCaptain`, `updateCaptainAbilities`, and `activateMoraleAbility` inside `src/game/progression.ts` and driven by `CAPTAIN_CONFIG`.
4. Damage Types — projectiles and weapons carry `damageType` and `resolveProjectiles` in `src/game/systems/projectiles.ts` applies `DAMAGE_EFFECTIVENESS` lookups imported from `src/config/progression.ts`.
5. Subsystem Damage & Repair — `createSubsystems`, `repairSubsystems`, and `applySubsystemDamage` are implemented in `src/game/progression.ts` and integrated into `resolveProjectiles` so subsystem hits are recorded and repairs run during `prepareShips`/per-tick repair steps.

## Implementation mapping

- `src/config/progression.ts` — configuration knobs: `XP_CONFIG`, `LEVEL_BONUSES`, `CAPTAIN_CONFIG`, and `DAMAGE_EFFECTIVENESS`.
- `src/game/progression.ts` — core logic: XP awarding, level-up handling, captain generation & abilities, subsystem creation & repair, and integration points for awarding XP during projectile resolution.
- `src/game/ships.ts` — ship factory now calls `generateCaptain` and `createSubsystems` so newly spawned ships are progression-ready.
- `test/vitest/*` — progression spec files exist for unit and integration coverage (see test suite names referenced across the repository).

## Notes & follow-ups

- Implementation follows the design closely; many constants are exposed in `src/config/progression.ts` so designers can tune values without changing core logic.
- Tests should use seeded RNG values and `createTestGameState` helpers when available to ensure deterministic progression outcomes.

References

- `src/game/progression.ts`, `src/config/progression.ts`, `src/game/ships.ts`