# Phase 3 — Ships Instancing (Pilot)

Base branch: dev

Status: Not started (scoped; pilot recommended for most common class/team)

Summary

Introduce InstancedMesh rendering for ships by batching ships by (class, team) and creating InstancedMeshes per submesh/material. Pilot on one common class/team before wider rollout.

Status now

- Ships are currently created as Groups composed of multiple Meshes, with some textures generated from rasterized SVGs. No instancing.

Expected outcome

- Ships of the same class/team are represented by one or more InstancedMeshes (one per sub-part/material), sharing geometries and materials.
- A `ShipInstancerRegistry` handles instance indices, free lists, and transforms.

Acceptance criteria

- Feature flag: `RendererConfig.instancing.enableShips` to toggle instancing for ships.
- Pilot implementation for one class/team reproduces visual fidelity of non-instanced ships.
- Proper handling of async asset availability: placeholders until rasterized textures are ready; migrate to instanced group when ready.
- Measured reduction in draw calls for homogenous fleets of the piloted class/team.

Test guidance

- Branch base: `dev` (create `dev/instancing/ships` for this work).
- Steps:
  1. Implement `ShipInstancerRegistry` with Groups per (class, team) and a small set of InstancedMeshes (one per material/submesh).
  2. When a ship asset is ready (SVG rasterized texture available), register the ship into the instancer and remove the legacy Group.
  3. Update transforms each frame via per-instance matrices and set `.needsUpdate` appropriately.
  4. Run scenes with many identical ships and measure draw-call reduction and visual parity.

Notes

- If many ship classes exist, benefits are lower; prioritize the most common class/team for the pilot.
- Be mindful of culling: InstancedMeshes are culled as a whole; consider splitting into multiple instancers if needed.
