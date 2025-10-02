# [TASK239] - StarDisk Component Refactor

**Status:** In Progress  
**Added:** 2025-01-27  
**Updated:** 2025-01-27

## Original Request

Refactor StarDisk.tsx to separate concerns into focused hooks + small components to improve readability, testability, and reduce per-frame allocations. The current component mixes rendering, shader/material lifecycle, texture setup, per-frame uniform updates, debug DOM/window helpers, bloom registration, and a large render-loop useFrame.

## EARS-Style Requirements

WHEN the StarDisk is rendered, THE SYSTEM SHALL create a mesh with the disk oriented along config.direction and placed at the computed local offset.  
**Acceptance:** Shallow render verifies mesh quaternion and position.

WHEN shader material creation fails, THE SYSTEM SHALL fallback to a basic MeshBasicMaterial.  
**Acceptance:** Simulate failure and assert fallback material.

WHEN debug query param is present, THE SYSTEM SHALL expose window helpers and render the debug overlay.  
**Acceptance:** Set location.search, mount and assert window APIs and overlay DOM.

WHEN animation progresses, THE SYSTEM SHALL update shader uniform iTime using simulation time if available else render clock else fallback stepping.  
**Acceptance:** Unit test wrapStarTime and useStarUniforms time selection logic.

## Thought Process

The StarDisk component is 1057 lines with multiple responsibilities:
1. Material creation and disposal (lines 206-242, 244-252)
2. Texture loading and configuration (lines 147-189)
3. Per-frame uniform updates (lines 385-991 in useFrame)
4. Pure utilities (wrapStarTime, isCopilotDebugEnabled - lines 37-67)
5. Bloom registration (line 382)
6. Debug window helpers (lines 331-380, 427-990)
7. Dev shader compile forcing (lines 280-329)
8. Mesh rendering (lines 1028-1056)

The refactor will extract these into focused hooks and components while maintaining API compatibility and all existing test coverage. The key principle is extraction, not rewriting - we preserve existing behavior.

## Implementation Plan

### Phase 1: Setup and Utils
- Create task file with EARS requirements (this file)
- Extract wrapStarTime and isCopilotDebugEnabled to src/utils/starDisk.ts
- Add unit tests for these pure functions
- Run typecheck and tests

### Phase 2: Texture Hook
- Create src/hooks/useStarTextures.ts
- Extract texture loading and configuration logic
- Update StarDisk.tsx to use this hook
- Run typecheck and tests

### Phase 3: Material Hook
- Create src/hooks/useStarMaterial.ts
- Extract material creation, disposal, and fallback logic
- Update StarDisk.tsx to use this hook
- Run typecheck and tests

### Phase 4: Bloom Hook
- Create src/hooks/useStarBloom.ts (simple wrapper)
- Update StarDisk.tsx to use this hook
- Run typecheck and tests

### Phase 5: Debug Hooks
- Create src/hooks/useStarDebug.ts (debug window helpers)
- Create src/hooks/useDevShaderCompile.ts (dev compile logic)
- Update StarDisk.tsx to use these hooks
- Run typecheck and tests

### Phase 6: Uniform Hook
- Create src/hooks/useStarUniforms.ts
- Extract the useFrame logic for updating uniforms
- Update StarDisk.tsx to use this hook
- Run typecheck and tests

### Phase 7: Mesh Component
- Create src/components/environment/StarDiskMesh.tsx
- Extract mesh rendering logic
- Update StarDisk.tsx to use this component
- Run typecheck and tests

### Phase 8: Final Validation
- Final typecheck and test run
- Review and cleanup
- Update documentation

## Progress Tracking

**Overall Status:** In Progress - 0%

### Subtasks

| ID  | Description                                           | Status      | Updated    | Notes |
| --- | ----------------------------------------------------- | ----------- | ---------- | ----- |
| 1.1 | Create task file and EARS requirements                | Complete    | 2025-01-27 |       |
| 1.2 | Extract pure utilities to src/utils/starDisk.ts       | Not Started | -          |       |
| 1.3 | Add unit tests for wrapStarTime and helpers           | Not Started | -          |       |
| 2.1 | Create useStarTextures hook                           | Not Started | -          |       |
| 2.2 | Update StarDisk to use useStarTextures                | Not Started | -          |       |
| 3.1 | Create useStarMaterial hook                           | Not Started | -          |       |
| 3.2 | Update StarDisk to use useStarMaterial                | Not Started | -          |       |
| 4.1 | Create useStarBloom hook                              | Not Started | -          |       |
| 5.1 | Create useStarDebug hook                              | Not Started | -          |       |
| 5.2 | Create useDevShaderCompile hook                       | Not Started | -          |       |
| 6.1 | Create useStarUniforms hook                           | Not Started | -          |       |
| 6.2 | Update StarDisk to use useStarUniforms                | Not Started | -          |       |
| 7.1 | Create StarDiskMesh component                         | Not Started | -          |       |
| 7.2 | Update StarDisk to use StarDiskMesh                   | Not Started | -          |       |
| 8.1 | Final typecheck and test validation                   | Not Started | -          |       |
| 8.2 | Code review and cleanup                               | Not Started | -          |       |

## Progress Log

### 2025-01-27

- Created task file with EARS requirements and implementation plan
- Reviewed existing StarDisk.tsx code structure
- Identified all responsibilities to extract
- Planned incremental refactor with validation after each step
