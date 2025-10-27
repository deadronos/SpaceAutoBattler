# DESIGN100 — Centralize Projectile Info & Beam Helpers

**Status:** Implemented
**Created:** 2025-10-27
**Authors:** GitHub Copilot (assistant)

## Overview

This design centralizes the repeated logic for resolving projectile configuration, category, and beam transform calculations used across simulation and renderer layers. It provides a single, well-typed API so both the simulation systems (projectile spawn, advance, damage) and renderer (instanced projectiles) use identical rules.

## Motivation / Problem Statement

Multiple files currently duplicate logic for resolving projectile category, visual scale, collider radius, beam width/length calculation and fallbacks (e.g., `src/game/systems/projectiles.ts`, `src/components/layers/ProjectilesInstancedLayer.tsx`, `src/game/systems/damage.ts`). Duplication causes:

- Risk of inconsistent behavior/visuals when one side changes.
- Hard-to-maintain fallback and defaulting logic.
- Scattered beam length/width calculations (hit point handling, metadata fallback) that should be deterministic and testable.

## Requirements (EARS-style)

1. WHEN a projectile key (bullet type) is requested, THE SYSTEM SHALL return a canonical resolved info object with category, visualScale, colliderRadius, and beam config [Acceptance: unit test verifies outputs for representative keys].

2. WHEN beam transform calculation is required, THE SYSTEM SHALL provide a deterministic helper to compute matrix, scale and position given projectile runtime data and geometry metadata [Acceptance: consistency test between renderer and simulation for sample input].

3. THE helper module SHALL be typed, importable from both simulation and renderer TypeScript modules, and NOT modify global state [Acceptance: types check with `npx tsc --noEmit`].

## API Proposal

File: `src/utils/projectileInfo.ts`

Exports:

- type ResolvedProjectileInfo = {
  category: ProjectileCategory;
  visualScale: number;
  colliderRadius: number;
  beamConfig?: ProjectileBeamConfig | undefined;
  baseRadius?: number;
  baseWidth?: number;
  baseLength?: number;
}

- function resolveProjectileInfo(bulletKey?: string | null): ResolvedProjectileInfo
  - Uses `getProjectileConfig` internally and geometry metadata where appropriate.

- function computeBeamTransform(params: {
  projectile: ProjectileEntity;
  metadata?: { baseWidth?: number; baseLength?: number };
  cfg?: ProjectileConfigItem;
}): { matrix: Matrix4; widthScale: number; lengthScale: number }

- function resolveProjectileCategory(bulletKey?: string | null): ProjectileCategory

## Interaction & Data Flow

- Renderer (`ProjectilesInstancedLayer`) will call `resolveProjectileInfo(key)` to determine baseScale and geometry crossover values. For beams it will call `computeBeamTransform` to get matrix to set on instance.
- Simulation (`projectiles.ts`) will call `resolveProjectileInfo` to get lifetime, colliderRadius and beam defaults for hit detection.

## Data Models

Relies on existing `ProjectileConfigItem` from `src/config/projectiles.ts` and the geometry metadata written by `src/utils/projectileGeometries.ts`.

## Error Cases & Edge Handling

- Unknown bulletKey -> fallback to `'bullet:laser'` config.
- Missing metadata -> fallback to config values or safe defaults.
- Beam with hitPoint beyond bounds -> clamp to min length 0.1.

## Testing Strategy

- Unit tests for `resolveProjectileInfo` with sample keys: `bullet:laser`, `missile:light`, `beam:laser`, `torpedo:standard` asserting expected fields.
- Unit tests for `computeBeamTransform` with synthetic projectile + metadata verifying matrix components and scales.

## Migration Plan

1. Create `src/utils/projectileInfo.ts` and unit tests.
2. Replace ad-hoc resolution logic in `src/game/systems/projectiles.ts` with calls to `resolveProjectileInfo`.
3. Replace duplicated logic in `src/components/layers/ProjectilesInstancedLayer.tsx` (beam length/width compute) to call `computeBeamTransform`.
4. Replace category resolution in `src/game/systems/damage.ts` to use `resolveProjectileCategory`.
5. Run typecheck & tests and iterate.

## Risks

- Small runtime differences in beam length calculation if not careful with clones vs references. Mitigation: use vector re-use patterns and unit tests.
- Import cycles: ensure `projectileInfo.ts` depends only on `config/projectiles.js` types and not on renderer modules.

## Notes

- This module must remain allocation-efficient; avoid creating heavy temporary objects in hot loops (use return of pre-allocated Matrix4 when possible or document that callers cache results).
- Follow repository coding conventions (2-space indent, semicolons, explicit exported types).

