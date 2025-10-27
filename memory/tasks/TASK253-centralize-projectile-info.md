# TASK253 - Centralize Projectile Info & Beam Helpers

**Status:** Not Started
**Added:** 2025-10-27
**Owner:** TBD

## Original Request
Centralize duplicated projectile resolution and beam transform logic used by simulation and renderer.

## Thought Process
This task implements the design described in `memory/designs/DESIGN100-centralize-projectile-info.md`. The aim is minimal, incremental changes so we can revert safely if any issues appear.

## Implementation Plan

1. Create `src/utils/projectileInfo.ts` with the exported helpers and types.
2. Add unit tests under `test/utils/projectileInfo.spec.ts` covering representative cases.
3. Replace logic in `src/game/systems/projectiles.ts` to use `resolveProjectileInfo` and `computeBeamTransform` for beam handling (one small commit).
4. Replace logic in `src/components/layers/ProjectilesInstancedLayer.tsx` to use the helpers for renderer-side beam matrix and scale calculation.
5. Replace category resolution uses in `src/game/systems/damage.ts` to call `resolveProjectileCategory`.
6. Run `npx tsc --noEmit` and `npm test`. Fix type errors and tests.
7. Commit changes and create PR with short summary and link to design file.

## Subtasks

| ID  | Description | Status | Updated | Notes |
| --- | ----------- | ------ | ------- | ----- |
| 1.1 | Create `src/utils/projectileInfo.ts` | Not Started | - | Core helper module |
| 1.2 | Add unit tests | Not Started | - | `test/utils/projectileInfo.spec.ts` |
| 1.3 | Update `projectiles.ts` | Not Started | - | Use resolver & computeBeamTransform |
| 1.4 | Update `ProjectilesInstancedLayer.tsx` | Not Started | - | Use computeBeamTransform for beam matrix |
| 1.5 | Update `damage.ts` | Not Started | - | Use resolveProjectileCategory |
| 1.6 | Run checks & tests | Not Started | - | Fix issues found |

## Progress Log

### 2025-10-27
- Task created and design added to memory.

## Acceptance Criteria
- `npx tsc --noEmit` passes
- Unit tests covering resolveProjectileInfo and computeBeamTransform pass
- Renderer and simulation produce identical beam transforms for sample case (verified in unit test)

