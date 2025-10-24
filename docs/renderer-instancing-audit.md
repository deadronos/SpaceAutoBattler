# Renderer Instancing Audit

Date: 2025-10-04
Author: GitHub Copilot (automated audit)

## Summary

This audit inspects renderer and effect code for current instanced rendering usage and identifies high-value opportunities to convert per-entity meshes to InstancedMesh to reduce draw calls and React/JS overhead. The primary immediate win is converting projectile rendering from per-entity `mesh` components to a small number of InstancedMesh groups (grouped by bulletType/material).

## Scope

Files and subsystems reviewed (non-exhaustive):

- Projectiles: `src/components/layers/ProjectilesLayer.tsx`, `src/components/Projectile.tsx`, `src/game/systems/projectiles.ts`
- Explosions: `src/components/explosions/*` (`instancedManager.ts`, `ExplosionRendererCore.tsx`, updaters)
- Particle effects / thruster trails: `src/components/ParticleTrails.tsx`
- Turret muzzle flashes: `src/components/Turret.tsx`
- Shields / shield shaders: `src/components/ship/ShipShield.tsx`, `src/renderer/shields/*`
- Ship rendering: `src/components/Ship.tsx`, `src/components/ship/ShipView.tsx`
- StarsField: `src/components/layers/StarsField.tsx` (already efficient using `points`)

## Findings

- Instancing already well used:
  - Explosions use `InstancedMesh` and a centralized `instancedManager` for instance counting and color attributes.
  - Particle trails (thrusters) use one `InstancedMesh` and update matrices in a single `useFrame` loop.

- High-priority candidate:
  - Projectiles are rendered in `Projectile.tsx` as individual `mesh` nodes with per-entity `useFrame` updates. This is a high-frequency, high-count workload and will benefit substantially from batching into instanced rendering.

- Medium-priority candidates:
  - Turret muzzle flashes are created per-turret; batching them into an instanced muzzle-flash layer will reduce node count and per-frame work.

- Low / deferred candidates:
  - Shields use rich per-ship shader uniforms (ripples, per-ship ripple queues). Converting shields to instanced rendering requires shader redesign (packing per-instance data into attributes or textures) and therefore has low short-term ROI.
  - Full ship model instancing is impractical at this time due to GLTF complexity and per-ship material uniqueness.

## Recommendations

1. Implement a ProjectilesInstancedLayer:
   - Group projectiles by `bulletType` or material key. Create one `InstancedMesh` per group and update all instance matrices in a single `useFrame` call.
   - Use `mesh.count` and mark `instanceMatrix.needsUpdate` (and `instanceColor` if used).
   - Register instanced meshes with existing bloom/selection providers (use `useBloomRegistration` similar to `ParticleTrails`).
   - Allocate capacity from a configuration value (e.g., max projectiles) to avoid re-allocations.

2. Batch muzzle flashes into an Instanced MuzzleFlash layer similar to ParticleTrails.

3. Keep shield and ship rendering as-is for now; revisit only if shader/data packing resources are acceptable.

4. Prefer manual `InstancedMesh` matrix updates for very dynamic/high-count systems. Use `@react-three/drei`'s `Instances`/`Instance` declarative API only for low-count or mostly static instance sets to avoid React-node churn.

## Implementation plan (short)

- PoC: Single InstancedMesh for all bullets to validate correctness and stable attribute updates + tests.
- Convert: Group-by-material InstancedMesh, update `ProjectilesLayer` to mount them, remove per-`ProjectileObject` meshes.
- Follow-ups: MuzzleFlash instancing, add perf benchmarks and tests.

## Acceptance criteria

- Visual parity for existing projectile visuals (position, rotation, scale, color/tinting) under normal simulation.
- Reduced React node count for projectiles; measurable reduction in draw calls or frame time in stress tests (high projectile counts).
- Tests updated to reflect new rendering approach (existing projectile geometry tests pass).

## Risks and notes

- Shields require shader rework to batch—this is non-trivial and should be scoped separately.
- Drei `Instances` is convenient, but creating/destroying many `<Instance/>` React nodes per frame reintroduces overhead; for projectiles prefer manual `InstancedMesh` control.

## Next steps

- Implement the `ProjectilesInstancedLayer` PoC (see project `memory/tasks` for tracked todos).
- Add unit and perf tests comparing before/after behavior with a high projectile-load fixture.

---

Task mapping (local todo list):

- `Convert projectiles to instanced rendering` (high priority)
- `Batch turret muzzle flashes` (medium priority)
- `Review shields and ships for instancing` (deferred, needs design)

If you want, I can start a minimal PoC implementation for projectiles and add tests/benchmarks next. Which should I do first: a small PoC or a full grouped-by-material conversion?
