# DESIGN204 — Refactor: Split `src/config/renderer.ts` into focused config modules

Status: Draft
Date: 2025-10-27
Related Tasks: TASK413

## Summary

`src/config/renderer.ts` groups multiple renderer concerns: motion smoothing, shield visuals and tuning, thruster glow defaults, particle trails settings, and postprocessing/bloom presets. This centralization increases the blast radius for changes and mixes unrelated responsibilities. The design below proposes a minimally disruptive decomposition into focused modules with a façade to preserve backwards compatibility during migration.

## Goals

- Reduce coupling and cognitive load by creating smaller, domain-focused config modules.
- Maintain backward compatibility via a re-exporting façade file so consumers remain unaffected during iterative migration.
- Improve testability and reviewability by co-locating related config and validation logic.

## Proposed Module Boundaries

- `src/config/shields.ts`
  - Exports: `ShieldVisualSettings`, `SHIELD_VISUALS`, `DEFAULTS`, `getShieldVisuals`, `SHIELD_TUNING`, `SHIELD_RIPPLE_TUNING`, `setGlobalShieldMaterial`.
  - Rationale: Shield visuals/tuning are artist-driven and deserve their own module for quick iteration.

- `src/config/effects.ts`
  - Exports: `ThrusterGlowConfig`, `THRUSTER_GLOW_CONFIG`, `PARTICLE_TRAILS_CONFIG`, `ParticleTrailsConfig` type, `HULL_TINT`, `TEAM_COLORS`.
  - Rationale: Effects (thrusters, particle trails, hull tint) are consumed together by renderer components — grouping them simplifies coordination.

- `src/config/motion.ts`
  - Exports: `RendererMotionConfig`, `RENDERER_MOTION_DEFAULTS`, `resolveRendererMotionConfig`, `RENDERER_VISUAL_CONFIG`.
  - Rationale: Motion smoothing and related helpers are used by both systems and renderer; isolating them avoids pulling big effect tables into low-level systems.

- `src/config/postprocessing.ts`
  - Exports: `PostprocessingConfig`, `POSTPROCESSING_CONFIG`, `BloomGroupConfig`.
  - Rationale: Postprocessing is a separate concern (render pipeline) and benefits from isolation.

- `src/config/renderer.ts` (façade)
  - Minimal re-export surface: `export * from './shields'; export * from './effects'; export * from './motion'; export * from './postprocessing';`
  - Rationale: Keeps the migration path safe; teams can incrementally switch consumers to direct imports if desired.

## Migration Strategy (incremental)

1. Create new modules and copy code from the legacy `src/config/renderer.ts` into the appropriate new files without behavior changes.
2. Implement `src/config/renderer.ts` as a thin façade re-exporting the new modules.
3. Run `npx tsc --noEmit` and fix any import/type issues introduced by the move (usually path updates for types).
4. Add unit tests for critical helpers (e.g., `getShieldVisuals`) to lock behavior.
5. Optionally update high-traffic consumers to import directly from the narrow modules for improved tree-shaking and clarity.
6. Remove any dead/duplicate code after verification and successful test runs.

## Testing & Validation

- Unit tests for `getShieldVisuals` to assert defaults and hull overrides produce identical output to current behavior.
- Smoke test asserting the façade's exported keys are unchanged (snapshot): `expect(Object.keys(await import('src/config/renderer'))).toMatchSnapshot()`.
- Full `npm run typecheck` and `npm test` to validate no regressions.

## Risks & Mitigations

- Circular imports: avoid moving types that create cycles — extract shared types to `src/types` if necessary.
- Mutation helpers (e.g., `setGlobalShieldMaterial`) must remain exported and re-exported by the façade to avoid runtime surprises.
- Codemod scope: prepare a small codemod script for mass-updating imports if the team chooses to switch consumers to direct module imports.

## Deliverables

- New files: `src/config/shields.ts`, `src/config/effects.ts`, `src/config/motion.ts`, `src/config/postprocessing.ts`, a small `src/config/renderer.ts` façade.
- Unit tests: `test/config/shields.spec.ts` and a façade parity smoke test.

## Acceptance Criteria

- Typecheck passes (`npx tsc --noEmit`).
- Existing tests remain green after migration.
- Façade export surface equals the original `renderer.ts` export keys.

---
