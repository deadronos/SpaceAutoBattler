# DESIGN201 — Refactor: Extract Subsystem Management Module

Status: Proposed
Date: 2025-10-27

## Overview

Move all subsystem lifecycle, damage and repair logic out of `src/game/progression.ts` into a focused module `src/game/subsystems.ts`. This centralizes repair, status transitions, critical-hit damage routing, and subsystem multiplier logic.

## Motivation

Subsystem responsibilities are a separate simulation concern (engine/weapons/shields health, status, repair). Keeping them in `progression.ts` mixes progression concepts with simulation mechanics. Extracting improves discoverability, testability and reduces coupling between progression and combat systems.

## Requirements (EARS)

- WHEN a ship is constructed, THE SYSTEM SHALL provide a deterministic subset of subsystem objects computed from ship HP and config multipliers. [Acceptance: unit tests for `createSubsystems`] 
- WHEN subsystem HP changes, THE SYSTEM SHALL update status according to configured thresholds. [Acceptance: tests for `updateSubsystemStatus`] 
- WHEN subsystems are repaired, THE SYSTEM SHALL apply captain repairSpeed and morale boosts and respect `repairPriority`. [Acceptance: tests showing repair order and amounts]
- WHEN a critical hit triggers subsystem damage, THE SYSTEM SHALL select subsystem using configured weights and apply damage according to configured damage range. [Acceptance: deterministic selection via seeded RNG]

## Design

New module: `src/game/subsystems.ts` exports:

- `createSubsystems(maxHp: number): Record<SubsystemType, Subsystem>`
- `updateSubsystemStatus(subsystem: Subsystem): void`
- `repairSubsystems(ship: ShipComponent, delta: number): void` (keeps the same public signature but moves implementation)
- `applySubsystemDamage(ship: ShipComponent, hullDamage: number, rng: SeededRng): void` (critical-hit routing and application)
- `getSubsystemMultiplier(subsystemType: SubsystemType, status: Subsystem['status']): number`

Design notes:
- Accept `SeededRng` from callers for deterministic tests.
- Keep `SUBSYSTEM_CONFIG` usage but document expected fields: `baseHpMultiplier`, `baseRepairRateMultiplier`, `targetWeights`, `subsystemDamageRange`, `repairPriority`, `damagedThreshold`, `offlineThreshold`, `criticalHitChance`.
- Make the selection strategy pure for testability: expose a helper `selectSubsystemForDamage(rand: number): SubsystemType` so tests can assert weight mapping.

## Migration plan

1. Create `src/game/subsystems.ts` with identical implementations extracted from `progression.ts` and unit tests added.
2. Replace local implementations in `progression.ts` with imports from the new module.
3. Update `src/game/systems/damage.ts` import if it references `applySubsystemDamage` via `progression` — switch to the new module or rely on `progression` re-export until migration complete.
4. Run full tests and fix any type or import issues.

## Tests

- `test/game/subsystems.spec.ts` covering selection weights (seeded RNG), status thresholds, repair behaviour with morale/captain modifiers, and critical-hit damage ranges.

## Risk & rollback

- Low risk: behavior preserved by keeping the same signatures and re-exporting from `progression.ts` while migrating. Rollback by re-importing functions from `progression.ts`.

## Notes

- Consider splitting purely deterministic helpers (selection) and mutating wrappers (applyDamage) to reduce surface area for side effects.
- Document `SeededRng` usage and prefer passing RNG in rather than constructing inside the module (improves test determinism).