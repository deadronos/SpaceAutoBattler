# TASK133 - Build/Test Resilience

**Status:** Completed  
**Added:** 2025-09-26  
**Updated:** 2025-09-27

## Original Request

"fix npm test" / "fix tests and npm build fails"

## Thought Process

- Vitest smoke imports still target `.js` extensions, but dynamic runtime imports now expect transformed `.ts` modules, causing module resolution failures.
- Projectile geometry specs call React components directly, triggering invalid hook usage after the React 19 upgrade and masking a regression where the component hardcodes the laser geometry radius.
- Webpack’s TypeScript pass on test files detects unsafe property access on `unknown` error objects and mocked loader metadata, halting `npm run build`.
- Aligning tests with the TypeScript source layout and consolidating projectile config lookups will unblock both unit tests and production builds.

## Implementation Plan

1. Replace the smoke import string array with a typed loader map that imports the `.ts` sources so Vite can transform each module during Vitest runs.
2. Add projectile configuration helpers to expose bullet-specific geometry radii, update `ProjectileObject` to consume them, and adjust specs to read from the shared helper.
3. Harden projectile geometry specs with scoped mocks for `react` and `@react-three/fiber`, ensuring hooks run without dispatcher errors while still validating geometry args.
4. Narrow caught errors and mocked loader types in test files to satisfy strict TypeScript checks triggered by `npm run build`.
5. Re-run `npm run typecheck`, `npm test`, and `npm run build` to confirm the fixes.

## Progress Tracking

**Overall Status:** Completed — 100%

### Subtasks

| ID  | Description                                                                     | Status        | Updated    | Notes |
| --- | ------------------------------------------------------------------------------- | ------------- | ---------- | ----- |
| 1.1 | Refactor smoke import spec to loader map and `.ts` extensions                    | Completed     | 2025-09-27 | Switched to `import.meta.glob` with correct relative paths and allowed real `three` imports. |
| 1.2 | Introduce projectile geometry helper and update component usage                 | Completed     | 2025-09-27 | Component now pulls radii via `getProjectileBaseRadius`; shared helper stabilises tests. |
| 1.3 | Mock React/R3F hooks in projectile specs and update import paths                 | Completed     | 2025-09-27 | Tests inspect JSX children to validate `sphereGeometry` args without hook violations. |
| 1.4 | Address TypeScript narrowing issues in test files                                | Completed     | 2025-09-27 | Added typed helpers for geometry specs and smoke error formatting. |
| 1.5 | Run validation commands (typecheck, test, build)                                | Completed     | 2025-09-27 | `npm run typecheck`, `npm test`, and `npm run build` all pass (build emits existing asset warnings only). |

## Progress Log

### 2025-09-26

- Reproduced `npm test` failures (smoke import module resolution, projectile geometry hooks) and confirmed `npm run build` TypeScript errors.
- Captured requirements and design updates for build/test resilience in memory bank.

### 2025-09-27

- Updated smoke importer to rely on Vite glob loaders, resolving missing module keys and enabling real `three` usage where needed.
- Reworked projectile geometry specs to analyze JSX output instead of relying on mocked `SphereGeometry` calls, removing hook dispatch errors.
- Reran `npm run typecheck`, `npm test`, and `npm run build`; all commands succeeded with only pre-existing webpack asset size warnings.
