# DESIGN059 — Projectile Instancing Performance

Status: Proposed
Date: 2025-11-16
Author: GitHub Copilot (agent)

## Context

Hot path: `ProjectilesInstancedLayer` in `src/components/layers/ProjectilesInstancedLayer.tsx`.

- Runs every render frame via `useFrame`.
- Uses `useArchetypeEntities` to fetch all projectile entities and then:
  - Ensures a per-bullet-type instanced group via `ensureGroup`.
  - Allocates an instance index via `group.manager.allocate(projectile.id)` for each projectile.
  - Computes a transform matrix (and optionally beam-specific transforms) and writes to the instanced mesh.
- Includes a high-density throttle (`HIGH_DENSITY_THRESHOLD` and `HIGH_DENSITY_UPDATE_INTERVAL`) but still does significant per-frame work under load.

## Findings

1. **Per-frame key and category resolution:** Each frame, for each projectile, we compute `key = projectile.projectile.bulletType ?? 'bullet:laser'` and read `category = projectile.projectile.category ?? info.category`.
2. **Per-frame allocation lookups:** `manager.allocate(projectile.id)` is invoked for every projectile; depending on the manager, this may use a map or other structure per frame.
3. **Full transform recomputation every frame:** Even when projectiles move deterministically at a lower simulation rate, their instance transforms are recomputed every render frame.

## Requirements (EARS)

- WHEN rendering projectiles, THE SYSTEM SHALL reuse static projectile metadata (key, category, info) without recomputing it each frame. (Acceptance: per-frame loop reads precomputed fields only.)
- WHEN allocating instance indices, THE SYSTEM SHALL minimize per-frame lookup complexity, especially at high projectile counts. (Acceptance: allocation cost stays low in profiling at thousands of projectiles.)
- WHEN projectiles do not move between frames or move at a slower fixed-step rate, THE SYSTEM SHALL avoid unnecessary transform recomputation. (Acceptance: frame loop can skip transform writes for non-updated projectiles without visual artifacts.)

## Design: Precomputed Render Metadata

- Extend projectile spawn logic to assign render metadata:
  - `projectile.renderKey` — precomputed bullet type key used by instancing (e.g., `bullet:laser`).
  - `projectile.renderInfo` — reference to a central `ResolvedProjectileInfo` instance created once for each key.
- Update `ProjectilesInstancedLayer` to rely on `projectile.renderKey` and `projectile.renderInfo` instead of calling `resolveProjectileInfo` or inferring key from `projectile.projectile.bulletType` every frame.

## Design: Allocation Strategy

- Where feasible, configure `InstancedLayerManager` to favor simple index assignment:
  - For example, if projectile IDs are numerically dense or bounded, consider using a ring buffer or sequential allocator that does not require a map lookup for each `allocate`.
- Alternatively, maintain a mapping from projectile index in the archetype array to instanced index and only change it when entities spawn or despawn.

## Design: Transform Update Throttling

- Tie transform updates to simulation ticks rather than render ticks:
  - Track the last simulation tick index on `GameState` (already exposed via `state.simulation.lastTickIndex`).
  - For each projectile group or for the entire layer, only recompute transforms when the tick index changes.
- For beams or projectiles whose appearance is tied closely to camera or time-based effects, allow per-frame updates but keep others tick-based.

## Data and API Changes

- No change to `ProjectilesInstancedLayer` public props.
- Projectile entities gain `renderKey` and optionally `renderInfo` fields populated at spawn.

## Validation Plan

- Add a small test or harness that:
  - Spawns many projectiles with pre-populated `renderKey` and `renderInfo` and verifies that `ProjectilesInstancedLayer` does not call `resolveProjectileInfo` or derive keys at runtime.
  - Measures frame time with and without transform throttling using a synthetic scenario.

## Risks and Mitigations

- **Risk:** Incorrect or stale render metadata leading to visual mismatches. Mitigation: keep render metadata derived from canonical projectile config and avoid mutating it after spawn.
- **Risk:** Transform throttling tied to ticks might cause jitter if render and simulation frequencies diverge significantly. Mitigation: continue to use interpolation where needed, but still avoid unnecessary recomputation when the underlying pose is unchanged.
