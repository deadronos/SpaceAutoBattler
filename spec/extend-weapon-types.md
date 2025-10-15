# Spec: Extend weapon types (missiles, torpedoes, beams)

Author: GitHub Copilot
Date: 2025-10-13
Status: Draft

## Summary

This document lists requirements, design, and an incremental plan to extend the game's weapon system beyond the current "bullet" family so it supports guided missiles, torpedoes (AoE warheads), and beam/hitscan lasers.

## Why

The repository currently couples visual/material keys and some behavior through the `bulletType` string and per-type visual config in `src/config/projectiles.ts`. That is convenient for visuals but brittle when the simulation needs distinct behaviors (homing, arming, AoE, or instant beams). Introducing explicit weapon categories and typed simulation fields keeps behavior testable, configurable, and renderer-agnostic.

## Requirements (EARS)

1. WHEN a ship or turret fires a weapon of category `missile` or `torpedo`, THE SYSTEM SHALL spawn a projectile entity with the configured kinematic and simulation fields required for guidance, arming, and AoE detonation.
   - Acceptance: spawn `missile:light` with `targetId` and verify it homes and detonates on impact with AoE damage.

2. WHEN a missile is not yet armed and collides with an entity, THE SYSTEM SHALL not detonate until `armingTime` has elapsed.
   - Acceptance: early collision while `armingTime` remains should not deal damage.

3. WHEN a weapon of category `beam` is fired, THE SYSTEM SHALL perform an immediate deterministic raycast (or spawn a short-lived beam entity) and apply damage instantly along the ray; the renderer shall show a short TTL beam effect.
   - Acceptance: firing `beam:laser` immediately reduces HP of the first hit target and a beam visual appears for the configured TTL.

4. WHEN an incoming missile enters a ship's point-defense (PD) range, THE AI SHALL expose an intercept/PD intent so PD-capable turrets prioritize destroying the incoming projectile.
   - Acceptance: a PD turret will switch target to an incoming missile entity and attempt interception.

## Design

### Data model

- Update `ProjectileComponent` (`src/types/combat.ts`) with optional simulation fields:
  - `category?: 'bullet' | 'missile' | 'torpedo' | 'beam'` — canonical simulation category.
  - `targetId?: number` — optional homing target entity id.
  - `homing?: { turnRate: number; lead?: boolean }` — guidance parameters (radians/sec, optional leading).
  - `armingTime?: number` — seconds before detonation allowed.
  - `armed?: boolean` — runtime flag (derived from spawn time + `armingTime`).
  - `aoeRadius?: number` — explosion radius in world units.

- Extend `ProjectileConfigItem` in `src/config/projectiles.ts` with those fields so weapons are data-driven.

### Simulation (systems)

- `fireProjectile` (`src/game/systems/projectiles.ts`):
  - Read `PROJECTILE_CONFIG` for the requested key and populate category/homing/aoe/arming fields on the spawned projectile.
  - For `beam` category call a new `fireBeam` helper that performs a deterministic raycast and applies instant damage; spawn a beam visual rather than a kinematic collider-based projectile.
  - Implementation note: beams should be implemented as deterministic raycasts in the simulation (decoupled from visuals). The raycast determines hits/misses and applies damage immediately; the renderer spawns a short-lived visual (for example a Line mesh from Drei) from the source to the hit point or toward the aimed target when missing. Beam visuals should have a configurable TTL (default: 0.5s) and may include small jitter on misses to improve perceived realism.

- `advanceProjectiles` (`src/game/systems/projectiles.ts`):
  - For homing projectiles compute steering each frame: determine desired direction to the `targetId` (optionally lead using target velocity), then slerp or rotate the current direction toward desired with a clamp of `homing.turnRate * delta`.
  - After steering, integrate the kinematic translation same as bullets (reuse `deferSetNextKinematicTranslation`).

- `resolveProjectiles`/damage (`src/game/systems/damage.ts`):
  - On impact, check `armed` (time-based); if not armed then obey configured behavior (ignore, fuse, or ricochet based on config in future iterations).
  - If `aoeRadius` is set, compute affected ships within radius and apply damage. For Phase 2 there will be no distance falloff (uniform damage inside the radius) to keep behavior simple; attribution of damage/XP must be to the projectile's source/owner.

### Rendering & VFX

- Add `missile:*`, `torpedo:*`, and `beam:*` entries to `PROJECTILE_CONFIG` and register matching materials in `src/renderer/materialRegistry.tsx` and implementations in `src/renderer/materials/`.
- `src/utils/projectileGeometries.ts` should return appropriate geometry for missile/torpedo visuals (elongated capsule or use GLTF model hooks). Ensure the instance transform composes correct rotation so the projectile's forward vector matches `projectile.direction`.
- Implement a `MissileTrailLayer` (or reuse `ParticleTrails`) for contrails and a `BeamLayer` for short-lived beam meshes (with bloom/emissive intensity configs).
  - For performance, missiles and torpedoes should be heavily pooled/instanced. The simulation may update instance transforms directly (or via a lightweight physics updater) rather than spawning many heavy objects. Consider using an update pool so guidance calculations and position integration are reused from preallocated objects.

### AI & rules

- Modify turret decision code (`src/game/systems/decision/*`) so PD-capable turrets detect incoming projectiles with `category === 'missile'` and add `point-defense` style intents. Add optional PD stats on ships (e.g. `pdRange`, `pdDps`) and tune doctrines.
  - PD stats are fine to add (for example `pdRange` and `pdDps`) but PD priority should be additive rather than exclusive: incoming missiles/torpedoes in PD range should increase a target's priority score so PD-capable turrets bias toward intercepting them, but not completely exclude other high-value targets. Missiles/torpedoes should be assigned a low-ish health attribute or `projectileHp` so PD fire can meaningfully destroy them.

### Data & balancing

- Use `DamageType` and `DAMAGE_EFFECTIVENESS` in `src/config/progression.ts` — `explosive` already exists and maps well to torpedo warheads; adjust as needed.
- Update `src/data/shipStats.ts` to assign `missile:*` or `beam:*` keys to hulls and tune `damage`, `range`, `projectileSpeed` and `fireRate` appropriately.
  - Ensure all projectile spawns track their `ownerId`/`sourceId` so AoE, torpedoes, and missiles can attribute damage/XP to the correct source. This ownership field should be carried through simulation and into damage resolution.

### Ship loadouts (recommended)

- General rule: do not replace existing turrets on ships; extend hulls by adding the new turret types where specified. Projectile speeds for PD/PD-bullets should be high enough to allow intercepting incoming missiles/torpedoes reliably (tune `projectileSpeed` so PD can feasibly catch projectiles at typical engagement ranges).

- Fighter
  - Keep current laser/bullet main weapon.
  - Add 1 small torpedo turret (turret-fired torpedoes) and 1 beam-turret (short-range beam laser) if appropriate for the fighter class balance.

- Corvette
  - 1 PD bullet turret (small, fast projectile) and 1 homing missile turret in addition to current weapons.
  - Optionally add 1 turret beam laser (short TTL) for anti-fighter work.

- Frigate
  - 1 PD bullet turret and 1 homing missile turret in addition to current weapons.
  - 1 turret beam laser.

- Destroyer
  - Keep existing weapons; add 2 PD bullet turrets, 2 torpedo turrets, 2 homing missile turrets, and 1 turret beam laser.

- Carrier
  - Keep existing weapons; add 2 PD bullet turrets, 1 homing missile turret, and 1 turret beam laser.

- Notes:
  - PD turrets should have high projectileSpeed and low per-shot damage intended to quickly chew through low-HP projectiles.
  - Torpedo turrets should use `aoeRadius` warheads and be balanced for broadsides (frontal arcs and guidance/arming tuned accordingly).
  - Missile turrets should use homing guidance with tunable `turnRate` and optional leading behaviour.

## Implementation plan (phased)

Phase 1 — schema + config (non-breaking)

- Add fields to `ProjectileComponent` and `ProjectileConfigItem` with safe defaults.

- Add `PROJECTILE_CONFIG` entries for `missile`, `torpedo`, and `beam` types.

- Replace brittle string checks (e.g., `includes('laser')`) with explicit category-based branches in `fireProjectile` and `advanceProjectiles`.

  Estimated effort: small. Run `npm run typecheck` and unit tests.

Phase 2 — AoE & arming

- Implement `aoeRadius` explosion handling in `resolveProjectiles` and ensure XP/interrupt accounting for multi-ship damage.

- Implement `armingTime` enforcement.

  Estimated effort: small–medium. Add unit tests for AoE and arming.

Phase 3 — homing guidance

- Implement guided-steering in `advanceProjectiles` and a simple lead option.

- Add missile trail visuals.

  Estimated effort: medium. Add deterministic guidance tests.

Phase 4 — beams/hitscan

- Implement `fireBeam` (deterministic raycast + instant damage) and a `BeamLayer` visual.

  Estimated effort: medium.

  - Implement `fireBeam` (deterministic raycast + instant damage) and a `BeamLayer` visual. The simulation's raycast result must be authoritative; the BeamLayer should render a Line (for example using Drei) between the source and the hit point or toward the aimed direction when no hit occurred. Default TTL for the visual is 0.5 seconds. Add configurable jitter for misses so beams that don't hit a target still show a believable endpoint.

Phase 5 — AI & PD

- Implement PD detection and turret intent rules; add PD stat fields and PD test scenarios.

  Estimated effort: medium.

## Files likely to change

- Types & config
  - `src/types/combat.ts` (extend `ProjectileComponent`, `TurretSpec` as needed)
  - `src/config/projectiles.ts` (add `category`, `homing`, `turnRate`, `aoeRadius`, `armingTime` fields and new entries)

- Simulation
  - `src/game/systems/projectiles.ts` (fire logic, guidance, beam branch)
  - `src/game/systems/damage.ts` (AoE application)

- Renderer
  - `src/renderer/materialRegistry.tsx` (register missile/torpedo/beam materials)
  - `src/renderer/materials/*` (implement missile and beam materials)
  - `src/utils/projectileGeometries.ts` (geometries / model hooks)
  - `src/components/layers/ProjectilesInstancedLayer.tsx` (ensure correct orientation)
  - optionally `src/components/layers/MissileTrailLayer.tsx` and `src/components/layers/BeamLayer.tsx`

- AI
  - `src/game/systems/decision/*` (turret intent changes for PD)

- Data
  - `src/data/shipStats.ts` (assign missile/beam weapons)

- Tests
  - `test/systems/missile.spec.ts`
  - `test/systems/beam.spec.ts`
  - `test/systems/aoe.spec.ts`

## Acceptance tests (minimal)

1. Homing missile test — spawn a homing missile (`targetId`, `turnRate`) and assert it rotates toward and intercepts the target within expected bounds after a deterministic number of ticks.

1. Torpedo AoE test — spawn torpedo and multiple ships inside `aoeRadius`; after detonation assert appropriate HP reductions and XP attribution.

1. Beam test — fire a `beam:laser` and assert immediate damage on the hit entity and that a beam visual is spawned for the configured TTL.

1. Tests should verify that firing a beam performs a deterministic raycast in the simulation (hit/miss), applies damage immediately, and that a beam visual is spawned with the configured TTL (default 0.5s). Visual jitter on misses should be testable by asserting the visual endpoint is within a small cone around the aimed direction.

1. PD test — scenario with an incoming missile and PD turret; assert turret interrupts other tasks and focuses on the missile, destroying it when PD DPS suffices.

## Risks & trade-offs

- Guided missiles add per-frame guidance cost; mitigate via guidance throttling, coarser steering updates, or seeker pooling.
- AoE damage attribution is ambiguous when multiple attackers are nearby; pick a deterministic attribution strategy and document it in progression events.
- Beam/hitscan rules affect perceived latency; keep beams deterministic server-side and spawn visuals client-side if/when networked.

## Follow-ups

- Add harness scenarios in `src/game/aiScenarioHarness` to load stress tests (many missiles, PD salvos, torpedo broadsides).
- Add tuning documents and experiment logs to `perf/baselines` and `plan/` for long-term balancing.

## Notes

Design objective: separate simulation semantics from rendering. Weapon categories and config-driven behavior allow adding hybrid weapons (e.g., beam that spawns an explosive warhead) without further coupling between renderer and simulation.
