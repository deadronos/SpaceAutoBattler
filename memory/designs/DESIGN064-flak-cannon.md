# DESIGN064 — Flak Cannon (Proximity Fuse) Feature Design

- **Status:** In Progress (PoC implemented)  
- **Owner:** TBD  
- **Created:** 2025-12-15
- **Confidence Score:** 70% (PoC exists; integration and balance to validate)

## Summary

Introduce a tactically interesting area-of-effect anti-swarm weapon ("Flak Cannon") that uses a proximity fuse to detonate near small targets. A PoC exists (`PROJECTILE_CONFIG['bullet:flak']`, proximityFuse/radius, and basic proximity detonation tests) but the feature requires design consolidation: interface contract, spawn/arming semantics, damage distribution, friendly-fire rules, AI usage, balancing, testing, and performance considerations.

## EARS-style Requirements

1. WHEN a projectile with `proximityFuse` spawns, THE SYSTEM SHALL arm the proximity fuse only after `armingTime` (if provided) and then detonate when any eligible target enters `radius`. _Acceptance:_ Unit tests exercise arming window and confirm detonation on proximity.

2. WHEN proximity detonation occurs, THE SYSTEM SHALL apply AOEs using `aoeRadius` config and distribute damage per `damageType` and falloff rules. _Acceptance:_ Vitest cases verify damage application to multiple entities and ignore friendly entities when configured.

3. WHEN a projectile has `proximityFuse`, THE SYSTEM SHALL avoid repeated detonation and correctly remove projectile entity from simulation state (no lingering references causing memory/perf issues). _Acceptance:_ Integration tests confirm projectile removal and deterministic cleanup.

4. WHEN AI selects weapons, THE SYSTEM SHALL prefer Flak Cannon against densely packed small hulls (fighters) and avoid wasteful firing at single large hulls. _Acceptance:_ AI usage scoring picks Flak with higher score against multi-target situations in simulation scenarios.

## Context & Constraints

- PoC: `PROJECTILE_CONFIG['bullet:flak']` contains `proximityFuse` and `aoeRadius` values. Unit tests (`test/vitest/flak-proximity.spec.ts`) exercise a few proximity cases and type alignment.
- Determinism: Use seeded RNG and deterministic projectile advance (no stochastic detonation thresholds). Avoid physics-dependent counters that may vary across environments.
- Performance: Proximity checks must be efficient (avoid O(N^2) per projectile). Use spatial structures (spatialHash or proximity buckets) or sample nearby candidates only once per simulation tick.

## Design

- Projectile lifecycle: spawn -> optional armingTime -> armed -> proximity checks each simulation tick -> detonate -> apply AOE damage -> spawn AOE effects & remove projectile.
- Proximity checks: leverage `state.spatialHash.querySphere(origin, radius)` (or equivalent) to find nearby entities; filter eligible targets by team (avoid friendly fire unless `allowFriendly` is true) and by hit masks.
- Damage application: on detonate, create damage events applying `aoeRadius`: damage falloff linear or inverse-square (configurable); support `maxTargets` or cull by proximity to limit worst-case cost.
- Testing & validation: Unit tests for armingTime & proximity; integration tests for AoE damage application and friendly-fire behavior; performance tests for large numbers of flak projectiles.

## Data Model

- `ProjectileConfigItem.proximityFuse = { radius: number }`
- `ProjectileState` gains `armedAtTick?: number` or `isArmed?: boolean` to track arming state.

## Implementation Plan

1. **Stabilize PoC (short-term)**
   - Verify `spawn` logic correctly sets armingTime and marks `isArmed` only after arming window.
   - Ensure `advanceProjectiles` checks `isArmed` before proximity detection.
   - Confirm removal & AOE damage application does not leave dangling references.

2. **Unit & Integration tests (short-term)**
   - Add tests for arming window, proximity detection, AOE damage distribution, friendly-fire tests, and deterministic behavior.
   - Add performance microbench that simulates many nearby flak shots to check spatial query performance.

3. **Balancing & AI (medium-term)**
   - Add tuning parameters (`aoeRadius`, `proximityRadius`, `damage`, `falloff`) to `data/ships` weapons for flak variants.
   - Update AI weapon selection heuristics to recognize AoE weapons and prefer in high-density engagements.
   - Run battle simulations to capture KPIs (kills per shot, damage efficiency) and iterate values.

4. **Documentation & UX (medium-term)**
   - Add a short feature entry to `FEATURE_IDEAS.md` expansion and update `docs/gamebalance-report` with balancing notes and test scenarios.
   - Add weapon descriptions for in-game UI and progression texts.

## Testing Strategy

- Type checks: `npx tsc --noEmit`.
- Unit: `vitest test/vitest/flak-proximity.spec.ts` plus additional AOE/damage tests.
- Integration: small simulation scenarios (AI squads vs carrier) to validate overall effect.
- Performance: simulate 1k projectiles with proximity checks using current spatial hash; measure tick time.

## Acceptance Criteria

- [ ] Proximity fuse behaves deterministically and arms correctly.
- [ ] AoE damage applies correctly with configured falloff and respects friendly rules.
- [ ] Projectile is removed without memory leak or lingering refs.
- [ ] AI uses Flak in appropriate scenarios and balancing KPIs meet expectations.

## Next Steps / Tasks

- TASK119 (flak-proximity test alignment) — Completed (type/test alignment).
- Create TASK155 to track Flak Cannon stabilization, tests, balancing, and AI integration.

```