# DESIGN200 — Refactor: Centralize damage calculation and application

Status: Proposed
Date: 2025-10-27

## Overview

Centralize and isolate combat damage math (effectiveness, absorption, overflow) into a dedicated module `src/game/combat/damage.ts` so combat resolution is pure, testable, and reusable by multiple systems (projectiles, environmental hazards, AOEs, beams).

## Motivation

Currently `calculateEffectiveDamage` lives in `src/game/progression.ts` and combat application logic (shield ripple, armor decay, XP awarding, subsystem damage) is split between `progression.ts` and `src/game/systems/damage.ts`. This coupling mixes progression concerns with combat simulation, makes unit testing harder, and increases the chance of duplicated or diverging damage math across features.

## Requirements (EARS)

- WHEN a damage source needs to resolve damage against a target, THE SYSTEM SHALL compute shield/armor/hull splits consistently and deterministically according to configured effectiveness values. [Acceptance: unit tests that exercise shield soak, partial-shield overflow and no-shield cases]
- WHEN damage is resolved, THE SYSTEM SHALL expose both a pure math API and a thin side-effect adapter for applying results to a ship entity. [Acceptance: pure function tests + integration test using `systems/damage` to confirm no behavior regression]
- THE new module SHALL accept config and RNG (when randomness needed) as explicit inputs to ensure deterministic tests. [Acceptance: tests using `SeededRng` reproduce selection/behavior]

## Design

Create `src/game/combat/damage.ts` and export two API surfaces:

1. Pure math API (no side-effects):
   - `calculateEffectiveDamage(baseDamage: number, damageType: DamageType, targetShield: number, targetArmor: number): { shieldDamage: number; armorDamage: number; hullDamage: number }`
   - Behaviour: identical algorithm to current implementation in `progression.ts` but with small, well-documented helper functions and unit tests.

2. Adapter (optional thin helper) that performs common side-effects in a single place but is pluggable:
   - `applyDamageResultToShip(state: GameState, projectileMeta, shipEntity, damageResult): { hullDamage: number; totalDamage: number }`
   - This adapter performs: reduce shield, reduce armor (with configured scaling), reduce hp, create shield ripple entries (using existing `ShieldRipple` model), call `applySubsystemDamage` hook or accept a pluggable callback, and return a summary. It will NOT itself award XP or emit explosions by default — instead it will accept optional callbacks for those side effects so callers can decide.

### Interfaces

- Pure function signature (TypeScript):
  - export function calculateEffectiveDamage(baseDamage: number, damageType: DamageType, targetShield: number, targetArmor: number): { shieldDamage: number; armorDamage: number; hullDamage: number }

- Adapter (recommended signature):
  - export function applyDamageResultToShip(options: { state: GameState; ship: ShipEntity; damageResult: ReturnType<typeof calculateEffectiveDamage>; source?: { id?: number; team?: number; bulletType?: string; category?: ProjectileCategory }; callbacks?: { awardXp?: (args) => void; onKill?: (args) => void; applySubsystemDamage?: (ship, hullDamage, rng) => void; emitRipple?: (ship, strength, dir) => void } }): { totalDamage: number; hullDamage: number; destroyed: boolean }

## Data flow

- `systems/damage.resolveProjectiles` (unchanged caller) will call `calculateEffectiveDamage` for the pure result and then call the adapter or perform side-effects by invoking a small set of exported helpers from the new module. This keeps `systems/damage` thin and focused on collision/selection.

## Migration plan

1. Add `src/game/combat/damage.ts` containing pure `calculateEffectiveDamage` and unit tests.
2. Update `src/game/systems/damage.ts` to import `calculateEffectiveDamage` from the new module and run tests.
3. Optionally add `applyDamageResultToShip` to the module and update `systems/damage` to use it; add integration tests.
4. Once stable, remove the old `calculateEffectiveDamage` from `progression.ts` or keep as re-export for backward compatibility while other modules are updated.

## Tests

- `test/combat/damage.spec.ts` covering:
  - shield fully soaks damage
  - partial shield break with correct armor absorption
  - no shields case
  - edge: zero or negative damage
  - armorAbsorption capped by targetArmor * armorEffectiveness

## Risk & roll-back

- Risk is low if we keep function signature identical and add re-exports to preserve imports. Roll back by pointing imports back to `progression.ts` and removing the new module.

## Notes

- Keep side-effects pluggable to avoid hiding XP awarding / explosion emission in the adapter unless tests demonstrate benefit.
- Ensure we continue to use `getDamageEffectiveness` from `config/progression`.
