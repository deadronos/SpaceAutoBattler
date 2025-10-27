# TASK102 - Implement Range Policy helpers and migrate range logic

**Status:** Completed
**Added:** 2025-10-27

## Original Request

Centralize AI range/speed/profile policy logic into `src/game/utils/rangePolicy.ts` and migrate usages in `spawnShip`, `projectiles`, and profile adjustment code.

## Thought Process

- There are multiple conditional checks of `AI_CONFIG.rangePolicy` and ad-hoc per-hull/per-style adjustments in several modules. A stable helper module will make changes easier and reduce risk of inconsistent behavior.

## Implementation Plan

- Step 1: Create `src/game/utils/rangePolicy.ts` that implements parity functions for current logic.
- Step 2: Add unit tests to assert equality with the existing functions for a set of representative inputs.
- Step 3: Replace `applyRangeVariance` in `src/game/ships.ts` with `rangePolicy.applyRangeVariance`.
- Step 4: Replace `resolveProjectileSpeed` internal policy-based adjustments to call `adjustProjectileSpeedForHullAndBullet`.
- Step 5: Replace logic in `src/game/systems/decision/profile-adjustment.ts` with `adjustBehaviorProfileRange`.
- Step 6: Run typecheck and tests, fix behavioral mismatches.

### Subtasks

| ID    | Description                        | Status    | Updated    | Notes                                                                         |
| ----- | ---------------------------------- | --------- | ---------- | ----------------------------------------------------------------------------- |
| 102.1 | Implement `rangePolicy.ts`         | Completed | 2025-10-27 | Added centralized range policy helpers with optional config overrides.        |
| 102.2 | Unit tests for parity              | Completed | 2025-10-27 | Created coverage in `range-policy.spec.ts` validating deterministic behavior. |
| 102.3 | Migrate `spawnShip` usage          | Completed | 2025-10-27 | Ship range variance now delegates to the shared helper.                       |
| 102.4 | Migrate `projectiles` usage        | Completed | 2025-10-27 | Projectile speed adjustments call `adjustProjectileSpeedForHullAndBullet`.    |
| 102.5 | Migrate `profile-adjustment` usage | Completed | 2025-10-27 | Decision profile range adjustments rely on the helper API.                    |
| 102.6 | Run CI / tests                     | Completed | 2025-10-27 | Lint, typecheck, and full Vitest suite executed after migrations.             |

## Progress Log

### 2025-10-27

- Task created.
- Implemented range policy module with parity tests and replaced ship, projectile, and profile adjustment call sites.
- Updated scripts and documentation exports to consume the new helpers; verified end-to-end via CI commands.
