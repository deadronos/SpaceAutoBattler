# DESIGN063 — Flak proximity tests type alignment

- **Status:** Completed  
- **Owner:** AI  
- **Created:** 2025-12-10  
- **Related Tasks:** TASK119  
- **Confidence Score:** 90% (high — small, localized TypeScript/test fix)

## Requirements (EARS)

1. **WHEN** firing projectiles in flak proximity specs **THE SYSTEM SHALL** pass `originPosition` through `FireProjectileOptions` (not `FireProjectileOverride`) so TypeScript accepts the call site. _Acceptance: `npx tsc --noEmit` reports no errors in `test/vitest/flak-proximity.spec.ts`._
2. **WHEN** executing `flak-proximity` Vitest cases **THE SYSTEM SHALL** still detonate flak rounds near enemies and ignore friendlies at the configured radius. _Acceptance: `vitest run test/vitest/flak-proximity.spec.ts --environment happy-dom` passes._
3. **WHEN** linting the updated spec **THE SYSTEM SHALL** adhere to repository formatting (2-space indent, semicolons) without eslint violations. _Acceptance: `npm run lint -- test/vitest/flak-proximity.spec.ts` reports zero errors._

## Context

`FireProjectileOverride` no longer accepts `originPosition`; callers must set it on `FireProjectileOptions`. The flak proximity Vitest file still places `originPosition` under `override`, producing TypeScript errors and blocking the test/lint pipeline.

## Design

- Update `flak-proximity.spec.ts` to pass `originPosition` at the top level of `FireProjectileOptions` while keeping `bulletType` inside `override`.
- Retain the existing spawn vector and proximity assertions so behavioral intent stays intact.
- Normalize formatting to match lint rules (2-space indentation).

### Interfaces

- `FireProjectileOptions`: `{ originPosition?: Vector3; override?: FireProjectileOverride; targetId?: number }`
- `FireProjectileOverride`: remains unchanged; callers should not include `originPosition`.

### Data flow

1. Test constructs `FireProjectileOptions` with `originPosition` and flak `bulletType` override.
2. `fireProjectile` clones `originPosition` (when provided) into `startPosition`.
3. Projectile spawn path stays unchanged; proximity fuse logic in `resolveProjectiles` continues to run with the spawned projectile component.

### Error handling matrix

| Failure | Detection | Response |
| --- | --- | --- |
| Type mismatch at flak test call site | `npx tsc --noEmit` | Fix shape to match `FireProjectileOptions`; avoid adding properties to `FireProjectileOverride`. |
| Lint style errors after edits | `npm run lint -- test/vitest/flak-proximity.spec.ts` | Reformat to 2-space indent/semicolons; keep imports untouched. |
| Flak proximity behavior regressions | `vitest run test/vitest/flak-proximity.spec.ts` | Verify projectile spawn position and proximity fuse radius; adjust test setup if behavior changed. |

### Testing strategy

- Type: `npx tsc --noEmit`.
- Unit: `vitest run test/vitest/flak-proximity.spec.ts --environment happy-dom`.
- Lint: `npm run lint -- test/vitest/flak-proximity.spec.ts` (or full suite if time permits).

### Implementation plan

1. Edit `test/vitest/flak-proximity.spec.ts` to move `originPosition` to `FireProjectileOptions` in all three cases and normalize formatting.
2. Run `npx tsc --noEmit`; re-run the targeted Vitest and lint commands if the environment allows.
3. Update task + design indices and record progress in the memory bank.
