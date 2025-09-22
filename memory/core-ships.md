# Memory — core-ships

File: `src/game/ships.ts`

Responsibilities

- Defines `SHIP_STATS` per hull and `spawnShip()` which instantiates Rapier rigid bodies/colliders plus ECS entities.
- Seeds ship combat state (hp/shield regen/cooldowns), model key, muzzle flash buffer, and turret state arrays.
- Attaches a deterministic AI component per ship (profile id from hull -> behavior profile, initial `AICommand`, `traitSeed`).

Integration

- Called by `state.ts` helpers (`spawnInitialFleets`, `spawnRandomShip`, `resetGame`) and tests; relies on `GameState.rapier`, `rng`, and `ai.tickInterval` to configure runtime state.
- Registers colliders in `GameState.colliderLookup` and turrets through `registerTurret` to keep cascade removal fast.
- AI profiles are resolved via `getDefaultProfileId` (see `src/game/aiProfiles.ts`); ships spawn ready for the decision system without additional wiring.

Tunables

- Per-hull stats: hp/shield pools, regen, damage, fire rate, projectile speed/range, move speed, scale, default bullet type, optional turret specs.
- Collider primitive (capsule) sized for current GLB scale; adjust if art assets change.
- Profile defaults can be overridden by editing `PROFILE_BY_HULL` in `aiProfiles.ts` for new roles/behaviors.

Updated: 2025-09-22
