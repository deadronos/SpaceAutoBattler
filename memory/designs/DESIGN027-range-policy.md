# DESIGN002 - Range Policy: centralized range/speed/profile adjustments

**Status:** Proposed
**Created:** 2025-10-27

## Summary

Centralize AI range-related policy logic (legacy `v0.1.1-exp` policy and related adjustments) into `src/game/utils/rangePolicy.ts`. The module will provide deterministic helpers for:

- applying weapon range variance (seeded RNG)
- adjusting projectile speed based on hull and bullet type
- adjusting AI behavior desired ranges based on profile style and hull

This unifies the conditionals currently present in `src/game/ships.ts`, `src/game/systems/projectiles.ts`, and `src/game/systems/decision/profile-adjustment.ts`.

## Motivation

Multiple files contain divergent implementations for range/speed/profile adjustments gated by `AI_CONFIG.rangePolicy`. Centralization reduces duplication and makes it easier to update or evolve the range policy.

## Goals

- Provide functions with the same semantics as the current code so migration is low-risk.
- Use the existing `SeededRng` for deterministic variance.
- Export small, focused helpers callable from spawn, projectile resolution, and decision systems.

## Proposed API (`src/game/utils/rangePolicy.ts`)

Exports:

- isLegacyRangePolicy(config?: typeof AI_CONFIG): boolean
  - returns `AI_CONFIG.rangePolicy === 'v0.1.1-exp'` with optional override/config injection.

- applyRangeVariance(baseRange: number, traitSeed: number, weaponIndex?: number): number
  - deterministic ±5% variation when legacy policy is active; otherwise returns `baseRange`.

- adjustProjectileSpeedForHullAndBullet(hull: string, baseSpeed: number, bulletType: string, overrideProvided?: boolean): number
  - implements the hull-based multipliers and bulletType adjustments used today in `resolveProjectileSpeed`.

- adjustBehaviorProfileRange(baseRange: readonly [number, number], style: string, hull: string): readonly [number, number]
  - encapsulates the `getEffectiveProfile` range adjustments used in `profile-adjustment.ts`.

## Migration plan

1. Implement `rangePolicy.ts` with unit tests that compare outputs to current functions for representative inputs.
2. Replace `applyRangeVariance` in `src/game/ships.ts` with `rangePolicy.applyRangeVariance`.
3. Replace `resolveProjectileSpeed` adjustments in `projectiles.ts` to call `adjustProjectileSpeedForHullAndBullet`.
4. Replace the logic in `getEffectiveProfile` to call `adjustBehaviorProfileRange`.
5. Run `npx tsc --noEmit` and `npm test` after each change.

## Tests and validation

- Unit tests for `applyRangeVariance` using known seeds and hulls comparing against existing behavior.
- Unit tests for `adjustProjectileSpeedForHullAndBullet` for each hull type and key bullet type cases.
- Unit tests for `adjustBehaviorProfileRange` for each profile style.

## Acceptance criteria

- All helper functions are covered by unit tests demonstrating parity with existing logic.
- After incremental migrations, the game's behavior regarding ranges and speeds remains identical (no test regressions).

## Notes

- The module should accept optional config injection to make testing easier (avoid global `AI_CONFIG` usage inside functions; callers can pass a config or use the default `AI_CONFIG`).
