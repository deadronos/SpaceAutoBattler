Title: Phase 1 — Bullets Instancing

Base branch: dev

Status: Not started (scoped and ready to implement)

Summary

Implement InstancedMesh-based rendering for bullets to reduce draw calls and improve rendering performance under heavy fire.

Status now

- Repo currently renders bullets as individual Mesh objects stored in `bulletMeshes` maps in `threeRenderer` and related code paths. No instancing is used.

Expected outcome

- One `THREE.InstancedMesh` (or a small set) manages all bullets.
- Per-bullet transforms are written to instance matrices once per frame.
- Draw calls substantially reduced when bullets > ~200.

Acceptance criteria

- Feature flag: `RendererConfig.instancing.enableBullets` enables/disables the instanced path (default true for feature branch testing).
- Visual parity: bullets look the same as legacy rendering (position, orientation, scale).
- No memory leaks or runaway capacity growth in typical gameplay; capacity may grow but bounded by config and logs warn when exceeding recommended thresholds.
- `instancedMesh.instanceMatrix.needsUpdate` is set once per frame after batch updates.
- Performance: under a stress test (heavy bullet spam), `renderer.info.render.calls` decreases by at least 40% compared to baseline.

Test guidance

- Branch base: `dev` (create feature branch off dev for implementation).
- Steps:
  1. Create a feature branch from `dev`, e.g., `dev/instancing/bullets`.
  2. Implement `BulletInstancer` in `src/renderer/threeRenderer.ts` or a small helper module.
  3. Add RendererConfig flags: `RendererConfig.instancing.enableBullets` and capacity settings.
  4. Replace bullet creation with allocation in the instancer and update instance matrices in `updateTransforms()`.
  5. Run the smoke script that spawns heavy bullet spam (`tmp/smoke-render-check.*`), or play a scenario with heavy firing, and record `renderer.info.render.calls` and triangle counts.
  6. Compare before/after numbers; run a visual inspection for parity.

- If you use the `gh` CLI to create a GitHub issue, paste the file content as the issue body; otherwise, open a new issue in the repository web UI and copy this content.

Notes

- Frustum culling is per-InstancedMesh; acceptable tradeoff for bullets. If counts are extremely high, consider spatial partitioning of InstancedMeshes as a follow-up.
