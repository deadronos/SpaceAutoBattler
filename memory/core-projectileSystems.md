# Memory — core-projectileSystems

Files: `src/game/systems/projectiles/*`
Related: TASK103 (projectile split), TASK104 (homing/beam subsystems), TASK161 (steering + point defense)

Summary

- The projectile pipeline was split out of the monolithic `src/game/systems/projectiles.ts` into a folder of focused modules. `updateGame` still calls `advanceProjectiles(state, dt)` and the public `fireProjectile(state, shooter, weaponKey, options)` entry point is re-exported from the folder's `index.ts`.
- Folder layout (see `src/game/systems/projectiles/README.md` for the canonical overview):

  | File                | Purpose                                                                                                                                                                                  |
  | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `index.ts`          | Re-exports `advanceProjectiles`, `fireProjectile`, `TEMP_POS`, and the public option/override types.                                                                                     |
  | `spawn.ts`          | Builds new `ProjectileEntity` instances; resolves projectile info, applies overrides, and routes beam vs ballistic behavior. Exposes `FireProjectileOptions` / `FireProjectileOverride`. |
  | `advance.ts`        | Per-tick motion, lifetime, arming, AoE trigger, and homing updates; writes resolved positions back to the entity.                                                                        |
  | `beam.ts`           | Beam-specific runtime state (`projectile.beam`), instant-hit geometry, and the `createBeamHitInfo` helper.                                                                               |
  | `homing.ts`         | Homing targeting + lead-angle guidance; uses `computeLeadDirection` from `src/utils/steering.ts`.                                                                                        |
  | `physicsAdapter.ts` | Bridges projectile motion to Rapier3D rigid bodies (`spawnProjectileEntity`).                                                                                                            |
  | `sharedTemps.ts`    | Module-scope temp `Vector3` / `Quaternion` scratch buffers for allocation-free hot paths (`TEMP_POS` is the canonical example).                                                          |
  | `buffers.ts`        | Ring/history buffers used by damage resolution to track impact chains.                                                                                                                   |

`FireProjectile` contracts

- `FireProjectileOptions`: optional `originPosition` and a nested `override` payload.
- `FireProjectileOverride`: `Partial<Pick<ShipEntity['ship'], 'damage' | 'projectileSpeed' | 'range' | 'bulletType' | 'damageType'>>` plus `projectileCategory`, `homing`, `armingTime`, `aoeRadius`, `beam`, `proximityFuse`, `targetId`.
- Speed is normalised through `adjustProjectileSpeedForHullAndBullet(hull, speed, bulletType, isOverride, AI_CONFIG)` so range-policy and AI multipliers apply uniformly.

Homing + point defense (TASK161)

- Torpedoes (`torpedo:standard`) are homing by default; `homing` overrides remain available.
- `priority: 'antiProjectile'` on turrets enables point-defense selection: pickers evaluate incoming hostile projectiles first and fall back to ship targeting when none exist. PD intercepts by damaging the projectile on hit (no projectile-vs-projectile collision is registered).
- `orientQuaternionFromDirection` (in `src/utils/steering.ts`) is the canonical way to align projectile visual transforms; the spawn pipeline applies it after a hit-direction is resolved.

Damage integration

- Hit resolution is funnelled through `calculateEffectiveDamage` / `applyDamageResultToShip` in `src/game/combat/damage.ts` (see `core-damage` memory if/when added). XP awards use `awardDamageXp` / `awardKillXp` from `src/game/progression/xp.ts`.
- Spatial-hash acceleration lives in `src/game/utils/spatialHash.ts` (`SHIP_GRID_CELL_SIZE = 12`); rebuilt per damage pass.

References

- `src/game/systems/projectiles/` (folder)
- `src/game/systems/projectiles/README.md`
- `src/utils/steering.ts` (orient/lead helpers)
- `src/utils/projectileInfo.ts` (`resolveProjectileInfo`, geometry metadata)
- TASK103 / TASK104 / TASK161
