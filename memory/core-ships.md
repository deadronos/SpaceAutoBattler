# Memory — core-ships

File: `src/game/ships.ts`

Responsibilities

- Defines `SHIP_STATS` per hull and exposes helpers to instantiate ships (`spawnShip`), create default motion stats for testing (`createDefaultMotionStats`), and spawn carriers/escorts via `spawnInitialFleets` / `spawnRandomShip`.
- `SHIP_STATS` contains full `ShipStats` including motion characteristics, default `bulletType`, `damageType`, `armor`, and optional `turrets` arrays used to spawn turret ECS entities.
- Ships are spawned as kinematic Rapier rigid bodies plus an ECS entity. `spawnShip`:
  - creates the Rapier `RigidBody` and a tuned capsule collider;
  - constructs an `AIState` for the ship (deterministic `traitSeed` derived from `state.rng`) and populates `ai` component with generated traits;
  - seeds progression state (xp, level, xpToNext) and attaches captain/subsystems/level bonus state via `generateCaptain`, `createSubsystems`, and `createLevelBonusState` so UI/progression systems can read deterministic defaults;
  - applies `applyRangeVariance` to main and turret weapon ranges when a range policy is enabled in `AI_CONFIG` to introduce small deterministic weapon range variation per-ship/weapon.
- For ships that list `turrets` in their `ShipStats`, `spawnShip` creates separate turret ECS entities (with tiny sensor colliders) and registers them via `registerTurret(state, parentId, turretEntity)` so turret lifecycle remains O(1) on parent removal. Turret entities have independent cooldowns and arc limits and are also inserted into `state.colliderLookup` for lookup.
- Carrier special-casing: when `blueprint.hull === 'carrier'`, `spawnShip` attaches a `CarrierComponent` using `CARRIER_LAUNCH_CONFIG` and initialises `activeFighterIds`, `launchIndex`, and `launchCooldownRemaining`.

Integration

- Called by `state.ts` helpers (`spawnInitialFleets`, `spawnRandomShip`, `resetGame`) and tests; relies on `GameState.rapier`, `rng`, and `ai.tickInterval` to configure runtime state.
- Registers colliders in `GameState.colliderLookup` and turrets through `registerTurret` to keep cascade removal fast.
- AI profiles are resolved via `getDefaultProfileId` (see `src/game/aiProfiles.ts`); ships spawn ready for the decision system with a deterministic `AIState` including a `command.ttl` seeded to the AI tick interval.

Tunables & Notable Helpers

- `createDefaultMotionStats()` provides a test-friendly fallback motion configuration used in unit tests and to validate motion stat schemas.
- `applyRangeVariance(baseRange, traitSeed, weaponIndex)` provides ±5% deterministic variance when `AI_CONFIG.rangePolicy` is set (policy: 'v0.1.1-exp'). This uses a secondary SeededRng derived from the ship `traitSeed` to avoid polluting global state.
- Turret sensor collider sizing and tiny ball colliders are intentional: turret entities don't participate in active collisions but are present to participate in physics world stepping and bookkeeping consistently.

Testing & recommendations

- Tests that validate deterministic spawning should set the `state.rng` seed and verify `entity.ai.traitSeed`, `ship.cooldown` ranges, turret cooldowns, and `xpToNext` calculations.
- When verifying carrier launch behavior, prefer calling `spawnInitialFleets` / `updateCarrierLaunchSystem` and assert fighters are queued and launched per `CARRIER_LAUNCH_CONFIG` rather than checking low-level timers directly.

Updated: 2025-09-30
