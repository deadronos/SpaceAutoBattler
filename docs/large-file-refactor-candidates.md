# Large `src/` files ready for decomposition

This note highlights three oversized source files whose responsibilities have accreted over time. Each section calls out the
current scope and proposes concrete seams for extracting smaller, easier-to-own modules.

## Summary snapshot

| File                                      | Approx. LOC | Primary responsibilities                                                               | Suggested split points                                                                                                          |
| ----------------------------------------- | ----------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/environment/StarDisk.tsx` | ~824        | Shader material wiring, runtime uniform updates, debug tooling, and fallback animation | Extract hooks for uniforms/timekeeping, standalone debug overlay module, and lightweight presentational component               |
| `src/components/lod/ShipLODManager.tsx`   | ~325        | LOD classification math, instanced impostor layer, and React orchestration             | Move pure partitioning helpers to `src/game` utils, split instanced layer into its own module, and expose a hook-driven manager |
| `src/types/ai.ts`                         | ~323        | Doctrine definitions, AI state, sensor visibility, metrics, and telemetry              | Separate doctrine/state typings from metrics/telemetry into focused declaration files with an index re-export                   |

## `src/components/environment/StarDisk.tsx`

_Why it is large:_ The component owns material creation, star textures, bloom hookup, optional game-state fallbacks, and a very
large `useFrame` loop that updates uniforms, debug overlays, and telemetry snapshots in one place (see the imports and setup up
front, plus the 200+ line frame handler that pushes alignment, diagnostic DOM markers, and debug telemetry).

_Pain points:_

- Debug logic (overlay DOM manipulations, telemetry buffers, console dumps) is intertwined with the render path, making the core
  star disk update loop hard to follow and risky to change when debugging is disabled.
- Timekeeping fallbacks and Rapier panic handling live alongside camera-alignment math and uniform uploads, so even small changes
  to progression handling require editing the monolithic frame update.
- Resource lifecycle (textures, shader material, debug overlay cleanup) is scattered through many `useEffect` blocks, increasing
  the cognitive load for future modifications.

_Recommended split:_

1. Extract a `useStarDiskUniforms` hook that encapsulates the `useFrame` block: compute time, wrap cycles, view alignment, and
   return the uniform payload for the presentational mesh.
2. Move debug-only behavior (DOM overlay management, telemetry export, forced material reapply) into a `StarDiskDebug` helper
   module invoked conditionally so the render path stays minimal.
3. Create a small wrapper component (e.g. `StarDiskView`) that only receives derived props (material, uniforms, offsets), while
   resource acquisition (textures, bloom routing) shifts to composable hooks.

## `src/components/lod/ShipLODManager.tsx`

_Why it is large:_ The file mixes low-level partitioning algorithms (`classifyLod`, `partitionShipsByDistance`), instanced mesh
population helpers (`populateImpostorInstances` and the nested `ShipImpostorLayer` component), plus the high-level `ShipLODManager`
React component that orchestrates hooks, state refs, and frame updates.

_Pain points:_

- Pure math helpers that belong near the game simulation live beside React-specific logic, so they cannot be reused by tests or
  non-React callers without importing the heavy component file.
- The instanced impostor layer implements its own frame loop and warning system inline, complicating targeted refactors to switch
  materials or pooling strategies.
- State refs for thresholds, ship collections, and partition results are hand-rolled inside the main component, obscuring the
  actual rendering responsibilities.

_Recommended split:_

1. Move partitioning helpers (`classifyLod`, `partitionShipsByDistance`, `computeLodPartition`, `partitionsEqual`) into a new
   `src/game/lod/partition.ts` module with unit coverage, letting both the React layer and any future systems reuse the math.
2. Extract `ShipImpostorLayer` and related instancing utilities into `src/components/lod/ShipImpostorLayer.tsx` so shader/material
   work can iterate independently of the manager.
3. Wrap the manager’s ref bookkeeping and frame updates in a custom hook (e.g. `useShipLodPartition`) that returns `{nearShips,
farShips}`, reducing component size and clarifying render vs. data responsibilities.

## `src/types/ai.ts`

_Why it is large:_ The file aggregates nearly every AI-related type in the project: intents, commands, doctrine card definitions,
blackboard structures, escort assignments, interrupt events, and the full metrics/telemetry schema for analytics dashboards.

_Pain points:_

- Downstream modules must import this monolithic declaration file even when they only need a narrow slice (e.g. doctrine cards or
  telemetry summaries), increasing TypeScript compile time and making diffs noisy.
- Documentation comments and optional legacy fields (e.g. vertical dispersion tracking, tie summaries) crowd the core intent
  types, making it difficult to spot breaking changes or audit unused telemetry.
- The metrics structures change more frequently than the stable runtime state, but both share the same file, forcing unrelated
  review for each tweak.

_Recommended split:_

1. Create a `src/types/ai/state.ts` module that defines intents, commands, AI state, blackboard data, and escort assignments.
2. Move doctrine-specific types (cards, modifiers, posture) into `src/types/ai/doctrine.ts` so doctrine work is isolated from
   runtime/metric changes.
3. Place metrics and telemetry summaries into `src/types/ai/metrics.ts`, leaving the main `ai.ts` file to re-export these slices
   via `index.ts` to preserve the public surface while enabling focused maintenance.
