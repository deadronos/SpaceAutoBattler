---
applyTo: 'src/renderer/**'
description: 'Rules for using instancing, prototype registration, and the asset pool.'
---

# Instancing & Asset Pool — Repo Rules

Receipt: "Use the project's instancing and asset pool APIs consistently to avoid memory leaks and ensure performance."

Plan: 1) Register prototypes during asset loading; 2) Allocate/free instances via instancer APIs; 3) Test uploads and capacity.

Checklist:
- [ ] Register prototypes only during the asset loading phase (renderer init). Keep registration deterministic and idempotent.
- [ ] Use `GameState.assetPool` for shared geometries/materials and the `shipInstancer` / `bulletInstancer` APIs for transforms and capacity management.
- [ ] When migrating placeholder meshes to instanced rendering, ensure both code paths (legacy / instanced) use the same transform math (quaternions derived from `ship.orientation`).
- [ ] Add unit/integration tests that assert instancer capacity, allocate/free bookkeeping, and correct matrix uploads.
- [ ] Dispose pooled assets on renderer shutdown; avoid recreating pools per frame.

Notes:
- Keep per-instance data minimal (matrices + color/flags). Avoid storing large objects per instance.
