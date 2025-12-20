# Memory — core-ships

File: `src/game/ships.ts`

Responsibilities

- Defines `SHIP_STATS` per hull and exposes helpers to instantiate ships (`spawnShip`), spawn initial demo fleets (`spawnInitialFleets`), and spawn single random ships (`spawnRandomShip`).
- `spawnShip(state, blueprint)` is the canonical entrypoint for creating ship entities in the simulation and performs the following steps:
  - Looks up hull stats from `SHIP_STATS` and computes derived values (motion stats, armour, shield capacity).
  - Creates a Rapier `RigidBody` (kinematic) and tuned capsule collider sized to the model conventions.
  - Initializes the ship's `AIState` and deterministic `traitSeed` using `state.rng` so trait generation remains reproducible.
  - Seeds progression fields (xp, level, xpToNext) and any captain/subsystem records required for UI and progression systems.
  - Applies deterministic weapon range variance when enabled via `AI_CONFIG.rangePolicy` using a secondary `SeededRng` derived from the ship's `traitSeed`.

Turrets & carrier behavior

- Ships that include `turrets` in their `ShipStats` have turret ECS entities created by `spawnShip`.
- Turret entities are registered using `registerTurret(state, parentId, turretEntity)` which stores turrets into `state.turretsByShip` for efficient cascade removal.
  Turret entities are registered using `registerTurret(state, parentId, turretEntity)` which stores turrets into `state.turretsByShip` for efficient cascade removal.
  Turret target scoring was adjusted to use a `bonusScale` when applying small/large hull bonuses so configured priority (e.g., `antiFighter`) composes reliably with squared distance scoring. See `src/game/systems/turrets.ts` for details and tests (`test/vitest/turret-priority.spec.ts`).
- Carrier hulls receive a `CarrierComponent` with `activeFighterIds`, `launchIndex`, and `launchCooldownRemaining` and rely on `updateCarrierLaunchSystem` to enqueue fighter spawns into the deferred queue so launches do not conflict with Rapier iteration.

Integration and testability

- `spawnInitialFleets` and `spawnRandomShip` call into `spawnShip` and rely on `state.rng` for deterministic placement and hull selection.
- Tests should seed `state.rng` directly to produce predictable ship spawns and verify derived fields such as `ai.traitSeed`, `xpToNext`, turret cooldowns, and `carrier.activeFighterIds` after a launch cycle.

Notable helpers & tuning

- `createDefaultMotionStats()` — test-friendly fallback motion configuration used across suites.
- `applyRangeVariance(baseRange, traitSeed, weaponIndex)` — deterministic ± variance applied per-weapon using a derived RNG so per-ship variance does not affect the global RNG stream.
- Turret colliders are small sensors and non-physics-interacting colliders to enable target and line-of-sight calculations without heavy physics interactions.

References

- `src/game/ships.ts`, `src/config/*` (ship-related tunables), `src/game/turretRegistry.ts`
