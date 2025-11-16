# DESIGN058 — Projectile Advance Performance

Status: Proposed
Date: 2025-11-16
Author: GitHub Copilot (agent)

## Context

Hot path: `advanceProjectiles` in `src/game/systems/projectiles/advance.ts`.

- Called once per simulation step from `updateGame`.
- Iterates all `ProjectileEntity` instances, handling:
  - Beam projectiles (skipped in this function).
  - Homing behavior via `findShipById` + `steerProjectileTowardTarget`.
  - Integrating position forward using speed and direction.
  - Clamping to world bounds and queuing kinematic updates via safe-kinematics wrappers.

Under heavy fire (hundreds or thousands of projectiles), this loop is a primary simulation hotpath.

## Findings

1. **Per-tick category resolution:** For each projectile, category is computed as `projectile.projectile.category ?? resolveProjectileCategory(projectile.projectile.bulletType)`. If `category` is not set at spawn, this causes repeated work every tick.
2. **Target lookup cost:** Homing projectiles call `findShipById(state, projectile.projectile.targetId)` each tick, which is likely O(N) over all ships.
3. **Two deferred kinematic operations per projectile:** Each non-beam projectile queues both translation and rotation updates every step, which may be more than necessary for some projectile types.

## Requirements (EARS)

- WHEN advancing projectiles each tick, THE SYSTEM SHALL avoid recomputing static projectile metadata like category. (Acceptance: category is fixed at spawn and only read during advance.)
- WHEN resolving homing targets, THE SYSTEM SHALL perform sub-linear or constant-time lookups per tick. (Acceptance: target resolution does not require scanning all ships each frame.)
- WHEN queuing physics updates, THE SYSTEM SHALL avoid unnecessary kinematic operations for projectiles that do not rely on them every tick. (Acceptance: some projectile classes perform fewer deferred calls without changing gameplay.)

## Design: Cache Projectile Metadata at Spawn

- Extend projectile spawn code (`spawn.ts` / `physicsAdapter.ts`) to:
  - Compute `category` using `resolveProjectileCategory` once and assign it directly to the projectile component (e.g., `projectile.projectile.category`).
  - Optionally precompute any other static info (e.g., resolved `ResolvedProjectileInfo`) and store it as `projectile.projectile.info` or under a `render` subfield.
- Update `advanceProjectiles` to trust these pre-populated fields and avoid calling `resolveProjectileCategory`.

## Design: Efficient Target Resolution

### Ship ID map

- Maintain a `Map` or object-based index `shipById` on `GameState` or on a dedicated lookup module:
  - Updated whenever ships are spawned or destroyed.
  - Maps `entity.id` (or a stable `shipId`) to the corresponding `ShipEntity`.
- Replace `findShipById(state, targetId)` with a map lookup.

### Optional: cached target references

- As a further optimization, consider storing a direct `targetRef` pointer on the projectile when lock-on happens.
- On each tick, validate the reference (e.g., check `targetRef.alive` flag); if invalid, fall back to a map lookup or clear homing.

## Design: Tailored Physics Updates

- Identify projectile categories that do not need full kinematic updates each tick, for example:
  - Visual-only tracers without physical collision after initial spawn.
  - Beams already handled via raycasts elsewhere.
- For such categories:
  - Either skip kinematic updates entirely, or update them at a lower frequency (e.g., every other tick) if Rapier state is still needed.
- For remaining projectiles, evaluate whether rotation updates can be skipped when direction does not change.

## Data and API Changes

- No change to `advanceProjectiles(state, delta)` signature.
- `ProjectileComponent` gains reliably populated `category` and possibly a `resolvedInfo` field at spawn.
- `GameState` gains a `shipById` map (or equivalent) and small helpers to keep it in sync.

## Validation Plan

- Add tests around spawn and advance:
  - Ensure `category` is set at spawn and `advanceProjectiles` never calls `resolveProjectileCategory` at runtime.
  - Verify homing projectiles still track valid ships and gracefully handle destroyed targets.
- Run a simple benchmark scenario with many projectiles before/after changes, comparing CPU time and allocation counts.

## Risks and Mitigations

- **Risk:** Stale `shipById` entries if not updated on ship destruction. Mitigation: centralize entity lifecycle management and ensure index updates occur in the same helpers.
- **Risk:** Reducing physics updates could diverge visual/physical positions for some projectiles. Mitigation: restrict reduced update paths to clearly visual-only projectile types and keep physical projectiles fully in sync.
