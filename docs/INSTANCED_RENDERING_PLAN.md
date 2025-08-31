# Instanced Rendering Plan (Bullets, Bars, Ships)

This document outlines a safe, incremental plan to introduce three.js InstancedMesh-based rendering to reduce draw calls and improve scalability during large battles.

Applies to this codebase:

- Renderer entry: `src/renderer/threeRenderer.ts`
- Entity sync/transforms: `syncEntities()`, `updateTransforms()` in `threeRenderer`
- Current maps: `shipMeshes`, `bulletMeshes`, `healthBarMeshes`, `shieldEffectMeshes`
- Billboard bars: pooled ShaderMaterial with cameraRight/cameraUp uniforms

Goals

- Reduce draw calls for large numbers of identical objects.
- Maintain visual parity and existing gameplay logic.
- Keep a clear off-ramp: feature flags to disable instancing per category.

Non-goals (for initial rollout)

- Changing simulation logic or file formats.
- Per-instance picking/collision (not used currently for bullets/bars).
- Instancing shield effects in Phase 1–2 (deferred; shader state too complex).

---

## Current Pipeline Snapshot

- Simulation updates run with a fixed step in `src/main.ts:startLoops`.
- `createThreeRenderer()` manages scene objects and per-entity Meshes in Maps.
- `render(dt)` calls `syncEntities()` (create/remove objects) and `updateTransforms()` (per-frame position/rotation/scale updates) and then renders.
- Health bars use a billboard shader with pooled materials (GPU_BILLBOARD = true) and are separate Meshes per bar layer.

Implication for instancing: we can replace per-entity Mesh creation with per-category InstancedMesh objects and update instance matrices/attributes in `updateTransforms()`.

---

## Rollout Plan (Phased)

We proceed in three phases for manageable risk and measurable gains.

### Phase 1 — Bullets (Low effort, high payoff)

Rationale: bullets share the same simple geometry/material, exist in high counts, and only need transform updates.

Design

- Create a `BulletInstancer` inside `threeRenderer.ts` that manages a single `THREE.InstancedMesh` (SphereGeometry + MeshBasicMaterial) for bullets.
- Maintain:
  - `capacity` (initial guess, e.g., 2048; grows by doubling when needed),
  - `freeList: number[]` for vacant instance slots,
  - `indexById: Map<number, number>` bulletId → instanceIndex,
  - `idByIndex: number[]` reverse map (optional; helps compact).
- On add:
  - Assign an index (pop from `freeList` or expand capacity) and store in maps.
  - Set initial matrix via `instancedMesh.setMatrixAt(index, matrix)`.
- On update:
  - Compute transform matrix (position; orientation optional for bullets) and call `setMatrixAt(index, matrix)`.
- On remove:
  - Clear maps; push index to free list (or swap-with-last to keep dense packing). For simplicity, free list is fine.
- Per frame:
  - After updates, set `instancedMesh.instanceMatrix.needsUpdate = true` once.
- Disposal cleanup: dispose geometry/material; clear maps.

Integration Points

- Replace `bulletMeshes` map usage:
  - In `syncEntities()`, stop creating `Mesh` per bullet; instead ensure a slot exists in the instancer.
  - In `updateTransforms()`, write matrices via instancer for bullets.
  - In removal loops, instruct instancer to free the slot instead of removing a mesh from `bulletsGroup`.
- Keep a feature flag: `RendererConfig.instancing.enableBullets` (default: true).

Acceptance

- Visual parity with legacy path.
- Substantially fewer draw calls when bullets > ~200.
- No leaks on rapid create/destroy cycles (capacity growth OK).

Risks & Mitigations

- Whole-mesh frustum culling (no per-instance culling): acceptable for bullets. Use scene bounds to avoid runaway counts.
- Index churn during removals: tolerate sparse allocation or occasionally compact (optional later).

Metrics

- Use `renderer.info.render.calls` and `triangles` before/after with synthetic heavy fire.
- Profile update cost: instance matrix writes are O(N) and cache-friendly.

---

### Phase 2 — Health/Shield Bars (Medium effort)

Rationale: many bars on screen; each bar has multiple layers (bg/health/shield/border) and already uses GPU billboard shader. Instancing reduces draw calls from O(N layers) to O(1 per layer type).

Design Options

- Option A (Pragmatic, minimal shader changes):
  - Create separate `InstancedMesh` per layer type:
    - Background bar (plane)
    - Health bar (plane scaled by health)
    - Shield bar (plane scaled by shield, optional)
    - Border (ring; could be skipped or instanced as simple thin plane shader)
  - Use the existing billboard shader logic; extend it to support instancing (no per-instance uniforms; use instanced attributes for color/alpha/scale).

- Option B (Unified advanced shader):
  - One instanced plane per ship and draw bg/health/shield within a single fragment shader using per-instance attributes (percentages/colors). Fewer draw calls, more shader work. Save for later if Option A is insufficient.

Recommended: start with Option A for clarity and parity.

Per-instance data

- Transform (matrix): position above ship as today, plus tiny Z offset to avoid z-fighting.
- Health percent: `healthScaleX` (float) via `InstancedBufferAttribute`.
- Shield percent: `shieldScaleX` (float), optional layer.
- Colors/alpha: per-instance vec3/float if needed; or keep pooled materials per color bucket (fewer material swaps).

Shader updates

- Billboard vertex shader already reads `cameraRight/cameraUp` from uniforms updated once per frame.
- Add attributes:
  - `attribute float aScaleX;` to scale in X (health/shield foregrounds).
  - Optional: `attribute vec3 aColor; attribute float aAlpha;`.
- In the vertex shader, apply scale using `aScaleX` to bar geometry. Background border layers keep `aScaleX = 1.0`.

Integration Points

- Replace `healthBarMeshes` map with `HealthBarInstancer`:
  - Provide methods: `ensureShip(id)`, `updateShip(id, position, health, shield)`, `removeShip(id)`.
  - Maintain one instanced set per layer type enabled by `RendererConfig.visual.enableHealthBars`.
- Update flow in `render()`:
  - After camera basis vectors are computed, update billboard materials once.
  - Call instancers’ `updateGPU()` to set `.needsUpdate` flags.
- Feature flags:
  - `RendererConfig.instancing.enableBars` (default: false initially).

Acceptance

- Bars remain camera-facing and track ships correctly.
- Health/shield values update on damage/regeneration.
- Draw-call reductions scale with ship count.

Risks & Notes

- Material pooling vs per-instance color: to minimize shader complexity, prefer small set of pooled materials by color and keep per-instance scale only in the first iteration.
- Z-order of multiple bar layers: ensure small positive Z offsets or renderOrder to avoid flicker.

---

### Phase 3 — Ships (Higher effort, conditional payoff)

Rationale: instancing shines when many identical meshes share a single geometry+material. Current ships are Groups of multiple meshes, some textured from SVG rasterization, and may vary by class/team.

Batching strategy

- Batch by (class, team) → one `InstancedMesh` per sub-part/material.
  - If a ship model uses 4 materials (body, nose, wings, panels), you will have 4 InstancedMeshes for that class/team.
  - Keep instance indices aligned across sub-parts (same `instanceIndex` for a given ship in each InstancedMesh), so a single free-list manages them.
- Alternative (asset baking): bake/merge the ship into a single geometry + single material using an atlas; best performance but more pipeline work.

Data flow

- When SVG asset becomes available and replaces placeholder, register the ship into the appropriate instancing group(s) instead of creating individual Meshes.
- Maintain `ShipInstancerRegistry`:
  - Keyed by `(class, team)` → `ShipInstancer` containing N InstancedMeshes (one per material/submesh), shared materials, and geometry references.
  - Maps: `indexById` and `freeList`, similar to bullets.
- Transforms
  - Compute per-ship transform matrix (position, rotation from `s.orientation`, scale) and write to each sub-part InstancedMesh.

Materials/colors

- Team color can be material-level: use two materials per class (red/blue) to avoid per-instance color attributes.
- Textures from rasterized SVGs must be identical across instanced ships within a group. If textures differ per ship, they cannot share the same InstancedMesh.

Feature flag

- `RendererConfig.instancing.enableShips` (default: false).

Acceptance

- Visual parity with the per-ship Group approach for the chosen class/team.
- Reduced draw calls when many ships of the same class/team are present.

Risks & Mitigations

- Mixed fleets with many unique classes lower the payoff; prioritize common classes.
- Async asset availability: only instance ships after the asset exists; otherwise temporarily render placeholders (non-instanced) and migrate into instancing once ready.
- Culling: whole-instanced-mesh culling per class/team. Consider splitting by quadrant for very large worlds as a later optimization.

---

## Deferred — Shield Effects Instancing

Current shields use a complex ShaderMaterial with per-ship uniforms (arrays of recent hits, timings, directions). Instancing would require migrating per-ship state into a data texture/TBO and indexing by instance ID in the shader. This is a sizeable shader refactor with modest payoff compared to bullets/bars. Defer until needed.

---

## Config & API Additions

Extend `RendererConfig`:

```ts
RendererConfig.instancing = {
  enableBullets: true,
  enableBars: false,
  enableShips: false,
  // optional tuning
  bullets: { initialCapacity: 2048, growFactor: 2 },
  bars: { initialCapacity: 1024 },
  ships: { initialCapacityPerGroup: 256 }
};
```

Renderer stats (optional):

- Report instance counts per category in the on-screen stats string (`FPS • Ships • Bullets • Tick`).

Feature toggles:

- Ensure easy fallback path: if a flag is false, original per-entity Mesh path remains.

---

## Implementation Tasks (Checklist)

Phase 1 — Bullets

- [ ] Add `RendererConfig.instancing.enableBullets` + capacity settings.
- [ ] Implement `BulletInstancer` (allocate InstancedMesh, maps, free-list, update methods).
- [ ] Integrate in `threeRenderer.syncEntities()` (ensure slot for each bullet, handle removals).
- [ ] Integrate in `threeRenderer.updateTransforms()` (write matrices, set needsUpdate).
- [ ] Wire disposal.
- [ ] Add stats: instance count vs bullet count.
- [ ] Manual test with heavy bullet spam; measure `renderer.info.render.calls`.

Phase 2 — Health/Shield Bars

- [ ] Add `RendererConfig.instancing.enableBars`.
- [ ] Implement `HealthBarInstancer` with per-layer InstancedMeshes (bg, health, shield, border optional).
- [ ] Add instanced attributes (`aScaleX`, optional color/alpha) and adapt billboard shader/material path to read them.
- [ ] Replace `healthBarMeshes` map usage with instancer calls; ensure camera uniforms update once per frame.
- [ ] Verify Z ordering of layers; adjust offsets or renderOrder.
- [ ] Manual test: damage/regeneration updates reflected; draw-calls drop with many ships.

Phase 3 — Ships (Pilot: one common class/team)

- [ ] Add `RendererConfig.instancing.enableShips`.
- [ ] Create `ShipInstancerRegistry` keyed by `(class, team)`; manage multiple InstancedMeshes (one per material/submesh).
- [ ] When asset ready, register ship into the correct instancer; remove standalone Group.
- [ ] Update transforms across sub-parts per instance index.
- [ ] Validate parity; measure draw calls for homogenous fleets.

Deferred — Shields

- [ ] Document shader data-texture approach and estimate effort; revisit if needed.

---

## Validation & Metrics

- Baseline: record `renderer.info.render.calls` and frame time with current implementation at high entity counts.
- After Phase 1: expect major reduction in calls when bullets dominate.
- After Phase 2: expect additional reduction proportional to ship count.
- After Phase 3 (pilot): meaningful reduction when many ships of the same class/team exist.

Smoke tests

- Existing `tmp/smoke-render-check.*` scripts can be adapted to spawn many bullets/ships and print `renderer.info` numbers.
- Optional: Add a debug overlay line for instance counts per category.

---

## Risks & Edge Cases

- Frustum culling: InstancedMesh culls as a unit. Acceptable for bullets/bars; for ships, group by class/team; advanced: spatial partitioning into multiple instancers.
- Async asset swap: ensure safe migration from placeholder Mesh to instanced group when texture arrives.
- Memory growth: capacity expansion should be bounded by sensible maxima (configurable; warn in logs when growing).
- Z-fighting in bars: use small Z offsets or renderOrder per layer.
- Materials variance: instancing requires identical material; keep a small material palette and batch accordingly.

---

## Suggested Timeline

- Day 1: Phase 1 bullets; A/B flag + measurements.
- Day 2–3: Phase 2 bars (Option A), stabilize visuals; measurements.
- Day 4+: Phase 3 ships (pilot for one class/team), evaluate ROI; expand as needed.

---

## Nice-to-haves (Later)

- Render-time interpolation alpha to smooth fixed-step sim (independent of instancing).
- Per-instance frustum culling via compute/CPU bucketing per quadrant/octant.
- Data-texture driven shields to enable instancing.
- Lightweight benchmarking harness that logs `renderer.info` under scripted load.
