# [TASK010] - Material & Texture Atlas for Instance-Friendly Materials

**Status:** Completed
**Added:** 2025-10-05
**Updated:** 2025-10-05

## Original Request

Create instance-friendly materials and texture atlas tooling to reduce material/shader switches and enable `instanceColor`/custom attributes across many instanced groups.

## Scope

- Update `src/renderer/materialRegistry.tsx` to expose instance-compatible material variants and provide documented fallbacks when attributes are unsupported.
- Implement a texture atlas utility to pack small UI/effect textures into shared atlases and provide UV helpers for per-instance UV offsets.
- Add tests and smoke scenes to validate visual parity and performance.

## Requirements (EARS-style)

1. WHEN many small visual effects require different textures, THE SYSTEM SHALL allow packing them into atlases and use per-instance UV offsets to avoid material switches. (Acceptance: reduced material binds and draw calls in perf harness.)

2. WHEN a material does not support `instanceColor` or custom attributes, THE SYSTEM SHALL provide a safe fallback (shared material or bake attribute into texture atlases). (Acceptance: unit tests and snapshot parity checks.)

## Implementation Plan

- Extend `materialRegistry` with instance-friendly factory functions and a `getInstanceFriendlyMaterial(key)` API.
- Add `scripts/tools/texture-atlas.mjs` for packing small textures used by effects and provide runtime atlas loaders.
- Add unit tests for material factory and atlas UV mapping correctness.

## Tests & Acceptance

- Unit tests for material factory outputs and fallback behavior.
- Visual smoke tests using atlased textures to validate parity.
- Perf harness results showing reduced material binds where applicable.

## Completion Notes

- Extended `materialRegistry` with attribute-aware instance material resolution, new thruster/impostor registrations, and richer fallback telemetry.
- Implemented runtime texture atlas helpers plus a CLI packer (`scripts/tools/texture-atlas.mjs`) for building shared atlases.
- Added unit tests covering atlas UV transforms and material manager fallbacks.

---
