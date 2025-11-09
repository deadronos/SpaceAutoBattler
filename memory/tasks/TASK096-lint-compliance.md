# TASK096 - Restore lint compliance across config, hooks, and effect updaters

**Status:** Completed  
**Added:** 2025-10-03  
**Updated:** 2025-10-03

## Original Request

Diagnose and fix the ESLint errors reported by `npm run lint:fix`, covering unused symbols in explosion effect updaters, missing React/environment globals in hooks, Node-only globals in browser code, and lingering `any` usages across AI harness utilities.

## Requirements (EARS)

- WHEN ESLint runs on the explosion effect updater modules, THE SYSTEM SHALL keep only the constants and parameters that are actually used so no `no-unused-vars` or `no-unused-args` violations remain. [Acceptance: `npm run lint` reports zero unused variable errors in `src/components/explosions/effectUpdaters/*.ts`.]
- WHEN the hooks that drive renderer interpolation and thruster visuals compile, THE SYSTEM SHALL import the necessary React types and rely on browser-safe environment guards so lint/type checks pass without `no-undef` findings. [Acceptance: `npm run lint` produces no `no-undef` errors in `src/hooks/useShipInterpolation.ts` or `src/hooks/useShipThrusters.ts`.]
- WHEN runtime config and AI harness utilities access shared state, THE SYSTEM SHALL avoid implicit Node globals and replace loosened `any` casts with typed helpers so linting finds no `no-undef` or `no-explicit-any` warnings in `src/game/config.ts`, `src/game/aiScenarioHarness.ts`, or `src/game/aiScenarioHarness/logging.ts`. [Acceptance: `npm run lint` and `npx tsc --noEmit` succeed without the flagged warnings in those files.]

## Thought Process

- Explosion effect updaters still import legacy capacity constants and accept unused parameters; we can drop the unused imports and mark optional parameters with `_` prefixes where required by the shared signature.
- Hooks were written assuming the global `React` identifier and Node's `process.env`; updating them to use explicit `RefObject`/`MutableRefObject` imports and `import.meta.env` keeps bundlers happy.
- `config.ts` currently uses CommonJS `require` for lazy loading, which trips ESLint—introducing a typed resolver registration lets uiStore provide the getter without Node globals while preserving laziness.
- AI harness diagnostics rely on `any` casts; refining the candidate structure to reuse `IntentCandidate` types and replacing `as any` environment reads will keep the diagnostics intact without silencing the linter.

## Implementation Plan

- [x] Clean up explosion effect updater imports/parameters (debris, plasma, fireball, flash, smoke, sparks, shockwave) to satisfy `no-unused-vars`.
- [x] Replace the CommonJS `require` pattern in `src/game/config.ts` with a resolver registration, remove unused constants, and tighten types.
- [x] Update AI harness files to use typed intent candidates and environment guards without `any` casts.
- [x] Refactor `useDevShaderCompile`, `useShipInterpolation`, and `useShipThrusters` to import the needed React/types, remove `any`, and lean on browser-safe env checks.
- [x] Run `npx tsc --noEmit` and `npm run lint` (or targeted lint script) to confirm the errors are resolved.

## Progress Tracking

**Overall Status:** Completed - 100%

### Subtasks

| ID  | Description                                       | Status    | Updated    | Notes                                                          |
| --- | ------------------------------------------------- | --------- | ---------- | -------------------------------------------------------------- |
| 1.1 | Fix explosion effect updater unused imports/args  | Completed | 2025-10-03 | Unused constants removed; capacity args prefixed when unused.  |
| 1.2 | Refactor `config.ts` resolver pattern and types   | Completed | 2025-10-03 | Added global resolver + typed slice; dropped legacy require.   |
| 1.3 | Tighten AI harness diagnostics typing             | Completed | 2025-10-03 | Diagnostics now reuse intent types and avoid `any`.            |
| 1.4 | Update React hooks to avoid globals/`any` usage   | Completed | 2025-10-03 | React types imported explicitly; thruster hook strongly typed. |
| 1.5 | Re-run lint/type checks and document verification | Completed | 2025-10-03 | `npx tsc --noEmit` and `npm run lint` now pass cleanly.        |

## Progress Log

### 2025-10-03

- Task captured with initial requirements and plan; pending implementation.

### 2025-10-03

- Removed unused explosion updater imports and marked unused capacity parameters, clearing `no-unused-vars` failures.
- Replaced `config.ts` lazy `require` with a typed global resolver and pruned unused tick constants.
- Updated AI scenario harness diagnostics to reuse `IntentCandidate` typing and eliminated loose `any` casts.
- Refactored dev shader compile/interpolation/thruster hooks to rely on explicit React types and browser-safe env checks; tightened thruster material typing.

### 2025-10-03

- Ran `npx tsc --noEmit` and `npm run lint`; both succeed after the refactors, confirming the lint breakages are resolved.

### 2025-10-03

- Final verification: `npx tsc --noEmit` and `npm run lint` both succeed; task closed.
