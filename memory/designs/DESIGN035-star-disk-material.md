# DESIGN: Split `src/renderer/starDiskMaterial.ts`

**Created:** 2025-10-27
**Author:** Copilot (assistant)

## Purpose

This design describes a small, low-risk refactor to split the large `src/renderer/starDiskMaterial.ts` into focused modules. The goals are:

- Improve readability and maintainability by separating concerns (textures, uniform derivation, material factory, dev helpers).
- Make production code (material creation & uniform updates) tree-shakable from dev-only logging helpers.
- Enable unit testing for pure functions (deriveHazeUniform, deriveBoundaryUniform) and reuse of texture helpers.
- Preserve public API (function names and types) so existing import sites remain functional.

## Files to create

Proposed new file layout (under `src/renderer/starDisk/`):

- `textures.ts` — fallback texture singletons and `resolveTexture()` helper.
- `uniforms.ts` — `deriveHazeUniform`, `deriveBoundaryUniform`, `clamp01`, and type exports for uniform shapes.
- `materialFactory.ts` — `createMainSequenceStarMaterial`, `updateMainSequenceStarUniforms`, `disposeMainSequenceStarMaterial`. Imports `textures` and `uniforms` helpers.
- `devHelpers.ts` — dev-only logging, `onBeforeCompile` poller, `dumpMaterialState`, and DOM indicators. Guarded by NODE_ENV or debug flag to keep production bundles small.

The original `src/renderer/starDiskMaterial.ts` will be replaced with a thin re-exporting file (or removed) that keeps the existing public exports for backward compatibility.

## Interfaces and public API

The refactor must keep these public functions/types stable (same names and exported types):

- `createMainSequenceStarMaterial(options: MainSequenceStarMaterialOptions): ShaderMaterial`
- `updateMainSequenceStarUniforms(material: ShaderMaterial, update: MainSequenceStarUniformUpdate): void`
- `disposeMainSequenceStarMaterial(material: ShaderMaterial | null): void`
- `deriveHazeUniform(...)`, `deriveBoundaryUniform(...)`
- Types: `MainSequenceStarMaterialOptions`, `MainSequenceStarUniformUpdate`, `StarDiskHazeUniformInput`, `StarDiskBoundaryUniformInput`

To minimize churn, the `src/renderer/starDiskMaterial.ts` file will be replaced by an `index.ts` that re-exports from `materialFactory.ts` and `uniforms.ts`.

## Design details

- Textures: create `FALLBACK_ORGANIC` and `FALLBACK_NOISE` singletons in `textures.ts`. These should be the single source of truth so that identity checks remain valid (some automation reads texture.name or width/height).
- Uniform derivation: move `deriveHazeUniform` and `deriveBoundaryUniform` to `uniforms.ts` as pure functions with unit tests. Keep `clamp01` internal but exported for tests if needed.
- Material factory: `materialFactory.ts` will import fragment and vertex shaders (as currently) and `COMMON_GLSL`. It will import textures via `textures.ts` and uniform derivation via `uniforms.ts`. Dev logging attachment should be implemented as an optional attach helper exported from `devHelpers.ts` (e.g., `attachDevHelpers(material, renderer)`), and called only when debug flag enabled. This avoids capturing material in a closed-over poller in a separated module.
- Dev helpers: Move the `onBeforeCompile` installation and `dumpMaterialState` into `devHelpers.ts`. Export a function `installDevHelpers(material: ShaderMaterial)` that sets `onBeforeCompile` and optionally returns a `dispose` function to remove poller/intervals.

## Risks and Mitigations

- Shared singletons: Ensure the fallback textures remain singletons; export them from `textures.ts` and have `materialFactory.ts` import them. Do not instantiate multiple fallback textures.
- Binding lifecycle: `onBeforeCompile` and poller logic currently capture `material` in a closure. `devHelpers.ts` must either accept the `material` reference or expose a function that attaches the dev behavior given the material and renderer instance to preserve lifecycle and avoid stale references.
- Circular imports: Keep the dependency graph one-directional: `materialFactory -> textures + uniforms + devHelpers`. Do not let `devHelpers` import from `materialFactory`.
- Uniform shape stability: Keep uniform keys and shapes identical. Add TypeScript type exports to make type mismatches caught at compile-time.

## Acceptance criteria

1. `npm run typecheck` (or `npx tsc --noEmit`) passes.
2. `npm test` passes (no regressions). If tests rely on dev-only globals they should still function.
3. Public exports listed above remain available at `src/renderer/starDiskMaterial.ts` import sites (or `src/renderer/starDisk/index.ts`), with the same names.
4. Unit tests added for `deriveHazeUniform` and `deriveBoundaryUniform` with edge-case inputs.

## Test plan

- Add vitest unit tests that import `uniforms.ts` and validate outputs for a set of facingCos and boundary inputs, covering negative, NaN, and extreme values.
- Smoke test: create a small runtime harness to call `createMainSequenceStarMaterial` with default options and call `updateMainSequenceStarUniforms` repeatedly to ensure no runtime errors and that texture fallbacks are used.

---

Design file end.
