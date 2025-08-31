# Phase 2 — Health & Shield Bars Instancing

Base branch: dev

Status: Not started (scoped and ready to implement)

Summary

Implement InstancedMesh-based rendering for health and shield bars (billboards). Reduce draw calls by batching layer types and add per-instance attributes for percentages/scales.

Status now

- Health bars are currently per-entity Meshes using a billboard shader and pooled materials; no instancing.

Expected outcome

- One InstancedMesh per bar layer type (bg, health, shield, border) or a unified instanced plane with per-instance attributes.
- Per-bar scaling/percent attributes are provided as InstancedBufferAttributes and used by the billboard shader to render health/shield amounts.

Acceptance criteria

- Feature flag: `RendererConfig.instancing.enableBars` toggles the instanced bar rendering.
- Bars remain camera-facing and visually match the legacy implementation.
- Health/shield updates reflect correctly in-frame when ship health or shield changes.
- Draw-call reduction measurable via `renderer.info.render.calls` when many ships are present.

Test guidance

- Branch base: `dev` (create `dev/instancing/bars` for work).
- Steps:
  1. Add `RendererConfig.instancing.enableBars` config and defaults.
  2. Implement `HealthBarInstancer` with per-layer `InstancedMesh` objects and InstancedBufferAttributes (`aScaleX`, optional color attributes).
  3. Migrate health bar creation/updates to the instancer; ensure camera uniforms `cameraRight`/`cameraUp` update once per frame.
  4. Run heavy-spawn tests (many ships) and verify draw calls decrease and health/shield values update correctly.

Notes

- Start with Option A (separate InstancedMesh per layer type) for minimal shader changes, then consider unifying into a single instanced shader if more optimization is needed.
