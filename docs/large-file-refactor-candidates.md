# Large `src/` files ready for decomposition

Two source files currently exceed 500 lines of code. This note records their
scope and proposes concrete seams for extracting smaller, easier-to-own
modules.

Earlier candidates in this note — `StarDisk.tsx` (removed), `ShipLODManager.tsx`
(split into `shipLodPartition.ts` + `ShipImpostorLayer.tsx`), and
`src/types/ai.ts` (split into `src/types/ai/`) — are no longer oversized; see
git history for the original analysis.

## Summary snapshot

| File                                         | Approx. LOC | Primary responsibilities                                                             | Suggested split points                                                                   |
| -------------------------------------------- | ----------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `src/components/environment/StarSphere.tsx`  | ~709        | Star material wiring, per-frame uniform updates, and inline `__copilot_*` debug code | Extract a uniform/timekeeping hook and a dev-only debug module                           |
| `src/components/environment/PlanetRings.tsx` | ~525        | Ring geometry/material construction, per-frame animation, and debug hooks            | Move shader/material builders into `src/renderer/` and keep the component presentational |

## `src/components/environment/StarSphere.tsx`

_Why it is large:_ The component owns star textures, material creation, and a
large inline `useFrame` block that updates uniforms, runs optional
camera-alignment math, and contains a substantial amount of `__copilot_*` debug
scaffolding directly in the render path.

_Pain points:_

- Debug overlays and telemetry live beside the hot uniform-update path, so the
  core loop is hard to follow and risky to change.
- Resource lifecycle (textures, material, debug cleanup) is spread across
  several effects.

_Recommended split:_

1. Extract a `useStarUniforms` hook that owns time wrapping, view alignment, and
   the uniform payload; keep the component presentational.
2. Move all debug-only behavior into a dev-only module (shared with the star
   debug work in issue #635) so production builds dead-code-eliminate it.

## `src/components/environment/PlanetRings.tsx`

_Why it is large:_ The file mixes ring geometry/material construction (including
shader setup), per-frame animation, and debug hooks in one component.

_Pain points:_

- Geometry/material builders are coupled to the component, so they cannot be
  reused or unit-tested in isolation.
- Animation and ring-configuration concerns share the same file.

_Recommended split:_

1. Move ring geometry and material construction into a `src/renderer/` module
   with focused tests.
2. Keep `PlanetRings.tsx` as a thin component that wires config to those
   builders and advances animation each frame.
