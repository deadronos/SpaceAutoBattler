# DESIGN202 — Refactor: Split Progression into XP / Leveling / Events

Status: Proposed
Date: 2025-10-27

## Overview

Split the large `src/game/progression.ts` file into focused modules handling XP, leveling/bonuses, and progression events (bounded history). Provide a small `src/game/progression/index.ts` that re-exports the pieces to keep external call sites stable during migration.

## Motivation

`progression.ts` currently contains diverse responsibilities: XP awarding, event history, level-up math, and subsystem helpers. Splitting improves clarity, allows more targeted tests, and makes it simpler to reuse the XP awarding logic in different gameplay systems.

## Requirements (EARS)

- WHEN damage or kill occurs, THE SYSTEM SHALL compute and apply XP using a shared `xp` surface. [Acceptance: `awardDamageXp` and `awardKillXp` unit tests]
- WHEN XP thresholds are met, THE SYSTEM SHALL apply level increments and update stat bonuses consistently. [Acceptance: tests for `checkLevelUp` including multi-level-ups]
- WHEN adding progression events, THE SYSTEM SHALL maintain at most N recent events per ship. [Acceptance: tests for bounded history helper]

## Design

Split into modules below inside `src/game/progression/`:

- `xp.ts` — computes XP amounts and exposes `awardDamageXp`, `awardKillXp` (pure helper for formulae + thin mutators calling the event helper and `checkLevelUp`).
- `leveling.ts` — exposes `checkLevelUp`, `applyLevelUpBonuses`, `createLevelBonusState`, `recoverBaseStat` and normalization helpers. This module knows about `calculateXpForLevel` and `calculateLevelBonus` from config.
- `events.ts` (or `stateHistory.ts`) — generic helper for append-and-cap behavior: `appendCappedHistory(map, key, item, max)` and `addProgressionEvent` wrapper that uses it.
- `index.ts` — re-export the public API used by other modules to maintain compatibility during migration.

### Interfaces

- `awardDamageXp(ship: ShipComponent, damageDealt: number, state?: GameState|null, shipId?: number, weaponKey?: string|null, weaponCategory?: ProjectileCategory|null): void`
- `checkLevelUp(ship: ShipComponent, state?: GameState|null, shipId?: number): boolean`
- `appendCappedHistory(map: Map<number, any[]>, key: number, item: any, max: number): void`

## Migration plan

1. Create new `src/game/progression/xp.ts`, `leveling.ts`, `events.ts` and unit tests.
2. Implement `src/game/progression/index.ts` that re-exports functions from the new modules.
3. Update import sites gradually (systems/damage already imports some functions) or keep `progression.ts` as an interim re-export that delegates to new modules.
4. Remove legacy code from old `progression.ts` once all imports updated and tests green.

## Tests

- `test/progression/xp.spec.ts` — xp calculations, event emission calls (using a mock state map).
- `test/progression/leveling.spec.ts` — multiple-level-up, recoverBaseStat behaviour.
- `test/progression/events.spec.ts` — capped history behavior.

## Risk & rollback

- Keep `src/game/progression.ts` as a shim that re-exports the new functions to keep changes non-breaking. Roll back by restoring original file content and removing new modules.

## Notes

- Keep pure formula functions separate from state mutation to ease unit testing. 
- Ensure all new modules import the config constants from `src/config/progression.js` as needed.
