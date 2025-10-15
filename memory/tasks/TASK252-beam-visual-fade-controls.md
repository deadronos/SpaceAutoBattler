# TASK252 - Beam Visual Fade Controls

**Status:** Completed  
**Added:** 2025-10-15  
**Updated:** 2025-10-15

## Original Request

Disable the fade out for beam visuals for now—short distances make them hard to see. The fade should become configurable in the projectile configs for later tuning.

## Thought Process

- Existing fade behaviour resides in `BeamVisualsInstancedLayer`, where instance colors are dimmed as `length / maxLength` approaches `1`. This hard-coded dimming is the likely culprit behind faint close-range hits.
- Beam visual metadata comes from `fireProjectile` and `BeamVisualConfig` in `src/config/projectiles.ts`, so exposing fade parameters there keeps tuning inline with other projectile controls.
- Types currently omit fade details, meaning both runtime ECS components and renderer helpers need extensions to carry optional fade data without breaking existing consumers.
- To unblock quick tuning, we will default the fade strength to `0`, allow configs to define strength/exponent, and ensure renderer logic gracefully handles missing or invalid values.

## Implementation Plan

1. Capture EARS requirements describing default brightness, configurable fade curves, and safe fallbacks.  
2. Publish design doc (`memory/designs/TASK252-beam-visual-fade-controls.md`) covering architecture, data flow, error handling, and testing.  
3. Extend combat types and projectile config resolution to support optional fade parameters with clamping defaults.  
4. Propagate fade data through beam spawning and update `BeamVisualsInstancedLayer` to compute brightness from the new config (defaulting to no fade).  
5. Add Vitest coverage for config resolution and renderer brightness logic, then run `npx tsc --noEmit` plus targeted beam suites.

## Progress Tracking

**Overall Status:** Completed — 100%

### Subtasks

| ID  | Description | Status | Updated | Notes |
| --- | ----------- | ------ | ------- | ----- |
| 1.1 | Record TASK252 EARS requirements. | Complete | 2025-10-15 | Added three requirements to `memory/requirements.md`. |
| 1.2 | Draft design doc and error matrix. | Complete | 2025-10-15 | Authored `memory/designs/TASK252-beam-visual-fade-controls.md`. |
| 1.3 | Extend combat types and projectile config for fade parameters. | Complete | 2025-10-15 | Added `BeamFadeConfig`, config resolver, and propagation through spawn logic. |
| 1.4 | Update renderer layer to honour configurable fade defaults. | Complete | 2025-10-15 | Replaced hard-coded dimming with config-driven brightness helpers. |
| 1.5 | Add tests and run validation commands. | Complete | 2025-10-15 | Authored Vitest coverage for brightness/config resolvers and ran targeted suites plus `npx tsc --noEmit`. |

## Progress Log

### 2025-10-15

- Logged TASK252 request, identified beam instanced layer as source of hard-coded fade, and confirmed projectile config path for future tuning.  
- Captured three EARS requirements ensuring default brightness, configurable fade curves, and safe fallbacks.  
- Produced design document detailing config resolver changes, renderer adjustments, error handling, and testing strategy.
- Implemented `BeamFadeConfig` types, resolved fade config in `src/config/projectiles.ts`, and propagated sanitized fade data through beam spawn/runtime state.  
- Replaced beam fade dimming in instanced layers with `computeBeamBrightness`, defaulting to full brightness while respecting optional fade parameters.  
- Added Vitest coverage for brightness helper and config resolver, verified default beam visuals omit fade, and executed `npx tsc --noEmit`, `npm test -- beam-visuals.system`, and `npm test -- projectile-beam-config`.
