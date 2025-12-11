# DESIGN003 - Steering & Transform Utilities

**Status:** Proposed
**Created:** 2025-10-27

## Summary

Create a small utility module `src/utils/steering.ts` (or `src/utils/transformUtils.ts`) that centralizes common vector/quaternion operations used for steering, aiming, and orientation. This will be used by projectiles, ship motion, turret aiming, and renderer orientation logic.

## Motivation

The codebase currently repeats several low-level math operations:

- vector normalization with zero-length guards
- computing lead vectors by combining target velocity with target-to-source direction
- computing angular differences and applying a max-turn (clamping) with lerp toward desired direction
- converting a direction vector into a quaternion via `setFromUnitVectors(FORWARD, dir)` with zero handling

Consolidating these ensures consistent numerical behavior and improves readability.

## Goals

- Provide robust, well-documented helpers that mirror current behavior.
- Reduce duplicated math across projectile homing, `motion.ts`, and `starDiskOrientation.ts`.
- Add unit tests covering edge conditions.

## Proposed API (`src/utils/steering.ts`)

Exports:

- FORWARD constant (Vector3) or accept injection of forward vector

- safeNormalize(dst: Vector3, src: Vector3, fallback?: Vector3): Vector3
  - Normalize `src` into `dst` with fallback if `src` length is near zero.

- orientQuaternionFromDirection(direction: Vector3, fallbackDirection?: Vector3): Quaternion
  - Returns a quaternion oriented from FORWARD to `direction`, safely.

- computeLeadDirection(targetPos: Vector3, sourcePos: Vector3, targetVelocity: Vector3, leadFactor = 0.5): Vector3
  - Returns a normalized direction vector that adds a lead component (matching existing homing lead behavior).

- steerDirection(currentDir: Vector3, desiredDir: Vector3, turnRate: number, delta: number): { newDir: Vector3, angle: number }
  - Computes the maximal allowed rotation (turnRate \* delta), and lerps/clamps the currentDir toward desiredDir, returns normalized result.

- clampAngle(angle: number, min: number, max: number): number
  - Small utility to clamp/normalize angles if needed by other systems.

## Migration plan

1. Implement `steering.ts` and unit tests for `safeNormalize`, `steerDirection`, `computeLeadDirection`, and `orientQuaternionFromDirection`.
2. Replace `steerProjectileTowardTarget` internals in `src/game/systems/projectiles.ts` to use `computeLeadDirection` and `steerDirection`.
3. Replace quaternion orientation code in `src/game/systems/motion.ts` and `src/renderer/starDiskOrientation.ts` to use `orientQuaternionFromDirection`.
4. Run `npx tsc --noEmit` and `npm test` and iterate on edge cases.

## Tests and validation

- Unit tests for `steerDirection` covering cases: no-op (same direction), small angle, large angle with limited `turnRate`, zero-length vectors.
- Unit tests for `computeLeadDirection` verifying it matches the previous `TEMP_LEAD` logic when `leadFactor` is 0.5.

## Acceptance criteria

- Unit tests ensure numeric parity for existing homing behavior.
- After migration of `steerProjectileTowardTarget`, the projectile homing tests remain passing.

## Risks & notes

- Slight numeric differences may occur because of normalization order or temporary vector reuse; tests should compare with reference outputs before switching callers.
