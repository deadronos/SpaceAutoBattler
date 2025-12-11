# [TASK119] - Flak proximity test type alignment

**Status:** In Progress  
**Added:** 2025-12-10  
**Updated:** 2025-12-10

## Original Request

User requested: “fix test linter typechecks.”

## Thought Process

- TypeScript errors show `originPosition` is being placed under `FireProjectileOverride` inside `test/vitest/flak-proximity.spec.ts`, but the type only permits it on `FireProjectileOptions`.
- Fixing the call shape should also satisfy linting (indentation/format) while preserving the behavioral assertions (detonation near enemies, no detonation far/friendly).
- Confidence is high because the change is localized to the test call pattern.

## Requirements (EARS)

1. **WHEN** firing flak in proximity specs **THE SYSTEM SHALL** supply `originPosition` on `FireProjectileOptions` instead of `FireProjectileOverride` so TypeScript accepts the call site. _Acceptance: `npx tsc --noEmit` passes._
2. **WHEN** running the flak proximity Vitest file **THE SYSTEM SHALL** continue to detonate near enemies and ignore friendlies at the configured radius. _Acceptance: `vitest run test/vitest/flak-proximity.spec.ts --environment happy-dom` passes._
3. **WHEN** linting the updated spec **THE SYSTEM SHALL** respect project formatting rules. _Acceptance: `npm run lint -- test/vitest/flak-proximity.spec.ts` reports no errors._

## Implementation Plan

- Move `originPosition` to the top level of `FireProjectileOptions` in all flak proximity test cases; keep `bulletType` under `override`.
- Normalize formatting to repository standards (2-space indent, semicolons).
- Re-run `npx tsc --noEmit`; attempt targeted Vitest + lint runs if the environment allows; document outcomes.

## Progress Tracking

**Overall Status:** In Progress — 80%

### Subtasks

| ID  | Description                                             | Status   | Updated    | Notes                                                                               |
| --- | ------------------------------------------------------- | -------- | ---------- | ----------------------------------------------------------------------------------- |
| 1.1 | Update flak proximity specs to use correct option shape | Complete | 2025-12-10 | Moved `originPosition` to `FireProjectileOptions` in all cases.                     |
| 1.2 | Normalize lint/style in the updated test file           | Complete | 2025-12-10 | Re-indented call sites to 2-space style.                                            |
| 1.3 | Run typecheck/tests and record results                  | Blocked  | 2025-12-10 | Typecheck/lint pass; Vitest run blocked by esbuild spawn EPERM in this environment. |

## Progress Log

### 2025-12-10

- Created task, captured requirements, and drafted plan aligned with DESIGN063.
- Updated `flak-proximity.spec.ts` to place `originPosition` on `FireProjectileOptions` and normalized formatting; ready for validation.
- Ran `npx tsc --noEmit` (pass) and `npx eslint test/vitest/flak-proximity.spec.ts` (pass). Vitest run (`vitest run test/vitest/flak-proximity.spec.ts --environment happy-dom`) failed early due to esbuild spawn EPERM in this sandbox; no test assertions executed.
