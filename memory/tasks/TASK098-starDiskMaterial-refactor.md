# TASK098 - Refactor `src/renderer/starDiskMaterial.ts` into focused modules

**Status:** Completed
**Added:** 2025-10-27
**Updated:** 2025-10-27

## Original Request

Split `src/renderer/starDiskMaterial.ts` into smaller modules for textures, uniforms, material factory and dev helpers. Create unit tests for pure functions and keep public API stable.

## Thought Process

This file mixes resource construction (fallback textures), pure math and uniform derivation, material creation, and verbose dev-only instrumentation. The least-risk path is to extract pure functions first (uniform derivation), then texture singletons, then the material factory, and finally move dev helpers behind an explicit installer so production code avoids carrying dev logic.

## Implementation Plan

1. Create new folder `src/renderer/starDisk/` and add the following files:
   - `textures.ts` — FALLBACK_ORGANIC, FALLBACK_NOISE and `resolveTexture()`.
   - `uniforms.ts` — `deriveHazeUniform`, `deriveBoundaryUniform`, `clamp01` and related types. Add unit tests for these pure functions in `test/`.
   - `materialFactory.ts` — `createMainSequenceStarMaterial`, `updateMainSequenceStarUniforms`, `disposeMainSequenceStarMaterial`. Import textures + uniforms.
   - `devHelpers.ts` — move `onBeforeCompile` logic and `dumpMaterialState` into an `installDevHelpers(material, renderer)` function that returns a `dispose()` function. Guard calls to this function with a debug flag.
2. Replace `src/renderer/starDiskMaterial.ts` with a thin re-export file or an index that re-exports the public API and keeps compatibility for importers.
3. Add unit tests:
   - `test/renderer/uniforms.spec.ts` — covers haze and boundary derivation edge-cases (NaN, negative, >1 values).
   - `test/renderer/materialFactory.smoke.spec.ts` — smoke test that creates a material, calls updateMainSequenceStarUniforms repeatedly, and disposes the material.
4. Run typecheck and tests. Fix type or import issues.
5. Remove any remaining dev-only globals from the production path; ensure dev code is only active when NODE_ENV !== 'production' or when explicit debug flag present.

### Subtasks

| ID    | Description                                                                               | Status    | Updated    | Notes                                             |
| ----- | ----------------------------------------------------------------------------------------- | --------- | ---------- | ------------------------------------------------- |
| 410.1 | Create `textures.ts` and export fallbacks                                                 | Completed | 2025-10-27 | Keep identity of fallback textures stable         |
| 410.2 | Extract `deriveHazeUniform`/`deriveBoundaryUniform` to `uniforms.ts` and write unit tests | Completed | 2025-10-27 | Added renderer-focused specs covering edge cases  |
| 410.3 | Move material creation & update logic to `materialFactory.ts`                             | Completed | 2025-10-27 | Imported textures + uniform helpers               |
| 410.4 | Extract dev helpers into `devHelpers.ts` and guard them                                   | Completed | 2025-10-27 | Added install/dispose hooks guarded by debug flag |
| 410.5 | Re-export public API for compatibility                                                    | Completed | 2025-10-27 | Replaced original file with proxy index           |
| 410.6 | Run typecheck & tests, fix breakages                                                      | Completed | 2025-10-27 | Iteratively fixed imports and verified toolchain  |

## Progress Log

### 2025-10-27

- Task created and design documented in `memory/designs/DESIGN-20251027-starDiskMaterial.md`.
- Completed module extraction into `src/renderer/starDisk/`, added renderer unit + smoke tests, and ran lint/type/test suite.

---
