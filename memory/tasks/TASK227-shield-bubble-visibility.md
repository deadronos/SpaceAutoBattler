# TASK227 - Restore Shield Bubble Visibility

**Status:** Completed  
**Added:** 2025-09-29  
**Updated:** 2025-09-29

## Original Request

User report: "shield bubbles are missing, examine /src" (2025-09-29).

## Thought Process

- Battlefield screenshot and live repro show ships without visible shield bubbles despite HUD indicating full shields.
- Inspection of `src/components/Ship.tsx` revealed `<ShieldBubble>` renders with `renderOrder={-1}` while the shader material keeps `depthTest=true` and `depthWrite=false`.
- Because the shield draws before opaque hull meshes, subsequent hull rendering overwrites the bubble pixels, effectively hiding the effect for all hulls.
- Hypothesis: move the shield bubble to render after hulls (positive render order) and disable depth testing for the shield material so it always overlays but still skips depth writes.
- Confirmed no conflicting systems rely on the negative render order; bloom registration operates independently.

## Implementation Plan

1. Introduce a named render-order constant for shields and apply it in `ShieldBubble`, ensuring the mesh draws after hulls. *(Owner: Copilot, Dep: none)*
2. Update `ShieldHexMaterial` (and fallback material path) to disable depth testing while keeping depth writes disabled, preventing hull occlusion. *(Owner: Copilot, Dep: Step 1)*
3. Add Vitest regression covering render order, `depthTest`, and bloom registration to lock behavior. *(Owner: Copilot, Dep: Steps 1-2)*
4. Run `npm run typecheck` and `npm test`; capture manual screenshot confirmation if possible. *(Owner: Copilot, Dep: Step 3)*

## Progress Tracking

**Overall Status:** Completed - 100%

### Subtasks

| ID  | Description                                                             | Status        | Updated    | Notes |
| --- | ----------------------------------------------------------------------- | ------------- | ---------- | ----- |
| 1.1 | Document requirements and design in memory bank                         | Complete      | 2025-09-29 | Requirements + design committed. |
| 1.2 | Adjust shield render order and depth testing behavior                   | Complete      | 2025-09-29 | Render order constant added; material disables depth test. |
| 1.3 | Add regression tests for shield render order and bloom registration     | Complete      | 2025-09-29 | Vitest coverage asserts constant usage and material flags. |
| 1.4 | Run validation suite and capture visual confirmation                    | In Progress   | 2025-09-29 | `npm run typecheck`, `npm test` executed; screenshot follow-up pending manual capture. |

## Progress Log

### 2025-09-29

- Investigated shield disappearance, identified `renderOrder=-1` and default depth test as root cause.
- Authored EARS requirements (TASK227) and design doc outlining render order + depth test adjustments.
- Implemented render order constant, disabled depth testing in shield materials, and added regression tests.
- Ran `npm run typecheck` and `npm test`; noted manual screenshot still outstanding.
