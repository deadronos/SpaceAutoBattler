# TASK009 - Ship hull visibility regression

**Status:** In Progress  
**Added:** 2025-10-05  
**Updated:** 2025-10-05

## Original Request

after introducing instancing some meshes like hulls are not rendered,

examine all our latest changes and render logc related to hulls, instancing, projectile instances etc.

and fix fully, make reasonable assumptions

## Thought Process

- Instanced LOD work introduced `ShipLODManager` plus pooled thruster/projectile renderers; hulls now disappear in the default battle view.
- Initial triage points to the LOD partition staying in its first-evaluated state, leaving every ship in the impostor cohort and skipping full hull meshes.
- Need to inspect impostor billboarding, thruster/projectile instancing, and bloom/color-write interactions for regressions after the refactor.
- Plan: document requirements, produce design for dynamic LOD updates, then adjust runtime code plus coverage.

## Implementation Plan

- Analyse recent LOD/instancing changes to confirm failure mode and capture acceptance requirements.
- Design dynamic partition updates and impostor visibility safeguards; outline code/test impacts.
- Implement `ShipLODManager` updates (per-frame partition refresh, default thresholds), impostor helpers, and any bloom/material tweaks revealed by analysis.
- Extend Vitest coverage for LOD transitions / instanced impostors; run type check + unit suite.
- Update memory bank progress, reflect on follow-ups (e.g., perf tuning, atlas alignment).

## Progress Tracking

**Overall Status:** In Progress - 75%

### Subtasks

| ID  | Description                                                   | Status      | Updated    | Notes                                                       |
| --- | ------------------------------------------------------------- | ----------- | ---------- | ----------------------------------------------------------- |
| 1.1 | Draft requirements/design and register task in memory bank    | Completed   | 2025-10-05 | Requirements added, DESIGN002 published                     |
| 1.2 | Implement LOD partition refresh and impostor visibility fixes | Completed   | 2025-10-05 | ShipLODManager per-frame partition + impostor helper merged |
| 1.3 | Extend coverage & run validation suite                        | Completed   | 2025-10-05 | Added LOD/impostor specs; tsc + vitest pass                 |
| 1.4 | Finalize documentation, reflections, and handoff notes        | Not Started | 2025-10-05 | Pending testing                                             |

## Progress Log

### 2025-10-05

- Created TASK245 to track ship hull visibility regression after instancing work.
- Started analysing `ShipLODManager` behaviour and identifying spec-driven deliverables.
- Authored EARS requirements and DESIGN002 covering per-frame partition refresh, impostor helper, and testing strategy; task index updated.
- Implemented per-frame LOD partition refresh, exported helpers, and updated impostor layer defaults in `ShipLODManager.tsx`; adjusted default near threshold to 1800.
- Added Vitest coverage for partition refresh and impostor saturation plus instanced-mesh orientation helper; ran `npx tsc --noEmit` and `npm test` (existing duplicate three.js warnings persist).
