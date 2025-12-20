# [TASK155] - Flak Cannon: stabilize, test, and balance

**Status:** Not Started
**Added:** 2025-12-15
**Owner:** TBD

## Original Request

Follow up on the Flak Cannon PoC (proximity fuse) by stabilizing lifecycle, adding deterministic tests, balancing damage/tuning, and integrating with AI usage heuristics.

## Thought Process

- A PoC exists and a test (`test/vitest/flak-proximity.spec.ts`) has already been created to validate basic proximity behavior and type alignment.
- The priority is to stabilize the lifecycle (arming, detonation, cleanup), add comprehensive tests (friendly fire, AoE damage), and then run balancing & AI integration experiments.

## Requirements (EARS)

1. **WHEN** a `bullet:flak` projectile is spawned, THE SYSTEM SHALL arm the proximity fuse after `armingTime` (if configured) and only detonate when an eligible target enters the `proximityFuse.radius`. _Acceptance:_ Unit tests confirming arming behavior.

2. **WHEN** a flak detonation occurs, THE SYSTEM SHALL apply AOEs with configurable falloff and respect `team` rules for friendly/hostile filtering. _Acceptance:_ Integration tests assert expected damage on friendly vs enemy entities.

3. **WHEN** the flak projectile detonates, THE SYSTEM SHALL remove projectile state cleanly and spawn any AOE effects as configured. _Acceptance:_ No lingering references, and the `state` no longer contains projectile entities after resolution.

## Implementation Plan

- Stabilize core logic in `src/game/systems/projectiles/*`:
  - Use `ProjectileState.isArmed` or `armedAtTick` to track arming time.
  - On each `advanceProjectiles` tick, query nearby entities using `spatialHash` and filter by team and collision masks.
  - On detonation, call `applyAoEDamage(origin, radius, damageConfig)` and mark projectile for removal in deferred mutations.
- Tests:
  - Extend `test/vitest/flak-proximity.spec.ts` to include AOE damage checks and friendly-fire scenarios.
  - Add a performance micro-test to validate spatial query behavior with many projectiles.
- Balance:
  - Expose tuning knobs in `src/config/projectiles.ts` and `src/data/weapon-balances.md`.
  - Run simulation sweeps against curated scenarios to capture KPIs and tune.
- AI:
  - Update `src/game/systems/decision/` heuristics to prefer flak for high-density small-target situations.

## Subtasks

| ID  | Description                              | Status      | Updated    | Notes                                   |
| --- | ---------------------------------------- | ----------- | ---------- | --------------------------------------- |
| 1.1 | Stabilize arming/detonation lifecycle    | Not Started | 2025-12-15 | Update projectile state & advance logic |
| 1.2 | Add tests for AoE damage & friendly fire | Not Started | 2025-12-15 | Extend existing flak tests              |
| 1.3 | Add performance microbench               | Not Started | 2025-12-15 | Ensure spatial queries scale            |
| 1.4 | Balance parameters via simulation sweeps | Not Started | 2025-12-15 | Capture KPIs and tune                   |
| 1.5 | Integrate AI selection                   | Not Started | 2025-12-15 | Prefer flak in multi-target contexts    |

## Acceptance Criteria

- [ ] Unit and integration tests for flak behavior pass in CI.
- [ ] No lingering projectile state after detonation.
- [ ] Performance microbench indicates acceptable tick cost for spatial queries with up to X concurrent flak rounds (define X during implementation).
- [ ] AI selects flak appropriately in curated simulation scenarios.

## Related

- DESIGN064 — Flak Cannon feature design
- TASK119 — Flak proximity type alignment (completed)
- `src/config/projectiles.ts` — contains `bullet:flak` config
- `test/vitest/flak-proximity.spec.ts` — existing spec

```

```
