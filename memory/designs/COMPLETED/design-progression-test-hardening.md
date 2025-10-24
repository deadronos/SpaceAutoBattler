# Design Memo — Ship Progression Test Hardening

## Overview

Vitest suites that construct ad-hoc `ShipEntity` instances now require the progression metadata introduced by TASK151. This memo defines a shared helper for tests to hydrate those fields, preventing runtime crashes when simulation systems reference `ship.subsystems`, `damageType`, or `armor`. The helper must stay in lockstep with production defaults (`createProgressionDefaults`, `createSubsystems`) so any schema change propagates automatically.

## Architecture

- **Helper Module (`test/vitest/helpers/progression.ts`)**
  - Exports a single function `applyProgressionDefaults(ship, options?)` that mutates a passed `ShipComponent` (or returns the enriched instance) with XP-level fields, damage typing, armor values, and subsystem health.
  - Internally calls `createProgressionDefaults(hull)` and `createSubsystems(maxHp)` from production code to avoid duplicating balance data.
  - Accepts optional overrides (e.g., custom `maxHp`, pre-seeded `captain`) but never omits required subsystem keys.
- **Test Suites**
  - Import the helper and call it inside local ship factory utilities immediately after the base component is assembled.
  - Suites that need bespoke subsystem states mutate the returned `ship.subsystems` (all keys already present) rather than re-creating the object.

## Data Flow

1. Test builds base `ShipEntity` literal with primary combat fields (`hp`, `maxHp`, `fireRate`, motion stats, etc.).
2. Test calls `applyProgressionDefaults(ship.ship, { hull, maxHp })` before returning/spawning the stub.
3. Helper pulls progression defaults for the hull to set:
   - `xp`, `level`, `xpToNext` initial values.
   - `damageType`, `armor`, optional captain seed.
4. Helper invokes `createSubsystems(effectiveMaxHp)` to populate `engine`, `weapons`, and `shields` records, ensuring `status: 'online'` and canonical repair rates.
5. Tests mutate subsystems as needed (e.g., to simulate damage) but base structure remains intact.

## Interfaces

```typescript
interface ProgressionOptions {
  hull?: ShipHull;
  maxHpOverride?: number;
}

function applyProgressionDefaults<T extends ShipComponent>(
  ship: T,
  options?: ProgressionOptions,
): T;
```

- Returns the same instance for chaining; mutates in-place to avoid extra allocations in tight loops.
- Defaults `hull` to `ship.hull` and `maxHpOverride` to `ship.maxHp`.
- Leaves existing `captain` or `damageType` overrides intact if already specified.

## Data Models

- **Subsystem Record**: `Record<'engine' | 'weapons' | 'shields', Subsystem>` with `hp`, `maxHp`, `status`, `repairRate` derived from `SUBSYSTEM_CONFIG`.
- **Progression Fields**:
  - Numerical: `xp`, `level`, `xpToNext` initialised to XP curve base values.
  - Type bindings: `damageType` from `HULL_DAMAGE_TYPES`, `armor` from `HULL_ARMOR_VALUES`.
  - Optional `captain` seeded deterministically via production helper (remains `undefined` for small hulls).

## Error Handling

| Scenario                                     | Detection                                                         | Response                                                                                              |
| -------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Helper receives ship without `hull` defined  | TypeScript typing + runtime fallback to `'fighter'` if absent     | Default to `'fighter'` mapping and log via `console.warn` in helper (only during tests)               |
| Production config missing hull key           | `createProgressionDefaults` throws or returns `undefined` entries | Fail fast with descriptive `Error` so tests surface missing config immediately                        |
| Negative/zero `maxHp` passed to helper       | Guard and default to `100` test HP, warn once                     | Prevents division-by-zero in subsystem calculations                                                   |
| Tests mutate subsystem record to delete keys | Not prevented by helper                                           | Add assertion helper `assertSubsystemKeys` in tests that rely on keys; document expectation in README |

## Unit Testing Strategy

- **Helper Unit**: Add focused spec verifying helper populates all required fields and respects overrides (new file `test/vitest/progression-test-helper.spec.ts`).
- **Integration**: Existing suites (`motion.system`, `projectile-resolve`, `ai-metrics`, `shield-regen`, `turrets`) rely on helper—successful execution proves coverage.
- **Regression**: Run full `npm test` to ensure no residual `undefined` subsystem access.

## Implementation Notes

- Keep helper pure aside from in-place mutation; return value convenience supports both mutation and chaining patterns used across tests.
- Export helper via relative path (`../helpers/progression.js`) so ESM imports resolve under Vitest.
- Document helper usage in failing specs while keeping comments minimal (code should explain itself).
