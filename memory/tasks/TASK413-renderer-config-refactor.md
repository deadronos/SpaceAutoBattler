# [TASK413] Implement `src/config` module split (renderer config)

**Status:** Not Started
**Added:** 2025-10-27
**Updated:** 2025-10-27

## Objective

Split `src/config/renderer.ts` into smaller modules (`shields.ts`, `effects.ts`, `motion.ts`, `postprocessing.ts`) and provide a façade `src/config/renderer.ts` that re-exports the original surface. Run typecheck and tests to validate parity.

## Implementation Plan

1. Create files:
   - `src/config/shields.ts` — copy shield visuals, defaults, tuning, helper functions.
   - `src/config/effects.ts` — copy thruster glow, particle trails, hull tint, team colors.
   - `src/config/motion.ts` — copy motion defaults and `resolveRendererMotionConfig`.
   - `src/config/postprocessing.ts` — copy postprocessing/bloom config.
2. Implement `src/config/renderer.ts` façade with `export * from './shields'; export * from './effects'; export * from './motion'; export * from './postprocessing';`.
3. Run `npx tsc --noEmit` and fix type import paths (particularly references to `ShipHull`, `MotionStats`, and shared types).
4. Add unit tests:
   - `test/config/shields.spec.ts` asserting `getShieldVisuals` behavior.
   - Façade parity test: `test/config/renderer-facade.spec.ts` snapshot of exported keys.
5. Iterate: update imports in a few consumer files to prefer direct module imports if desired; otherwise keep existing façade usage.
6. Submit PR with summary, design doc link `memory/designs/DESIGN-RENDERER-REF204.md`, and tests.

## Subtasks

- [ ] Create `src/config/shields.ts` and copy shield-related code
- [ ] Create `src/config/effects.ts` and copy effects-related code
- [ ] Create `src/config/motion.ts` and copy motion code
- [ ] Create `src/config/postprocessing.ts` and copy postprocessing code
- [ ] Implement `src/config/renderer.ts` façade
- [ ] Add/adjust tests and run typecheck
- [ ] Open PR and request review

## Notes

- Preserve `setGlobalShieldMaterial` and tuning mutation helpers on the public surface.
- Avoid circular type dependencies — move shared types to `src/types` if necessary.

---
