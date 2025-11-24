# TASK115: BloomProvider Refactor Phase 2 — Extract Pure Logic Modules

**Status:** Pending  
**Created:** 2025-11-24  
**Design:** [DESIGN061](../designs/DESIGN061-bloom-provider-refactor.md)  
**Estimated Effort:** 2-3 hours  
**Priority:** Medium

## Original Request

Phase 2 of the BloomProvider refactoring: Extract pure logic functions into separate modules with comprehensive unit tests. This is the core extraction phase that enables independent testing and maintenance of bloom subsystems.

## Thought Process

The current `BloomProvider.tsx` mixes React component logic with pure utility functions. By extracting pure functions first (before touching the React component), we can:

1. Write focused unit tests for each concern
2. Identify and fix edge cases in isolation
3. Replace `/* ignore */` catch blocks with proper error handling
4. Reduce `any` casts by adding proper type guards

The order of extraction matters: start with the simplest module (layer allocation) and work toward the most complex (material management).

## Implementation Plan

### Subtask 2.1: Create `layerAllocator.ts` with tests

- Implement `normalizeLayerIndex(value: unknown, fallback: number): number`
- Implement `allocateLayer(state: LayerAllocatorState, group: string): number`
- Implement `computeLayerMask(selections: Map<string, Selection>): number`
- Write tests for:
  - Layer clamping to `[0, 31]`
  - Non-finite input handling
  - Allocation increments correctly
  - Mask computation for multiple selections

### Subtask 2.2: Create `selectionManager.ts` with tests

- Implement `createSelection(layer: number, exclusive?: boolean): Selection`
- Implement `addObjectToSelection(selection: Selection, obj: Object3D): void`
- Implement `removeObjectFromSelection(selection: Selection, obj: Object3D): void`
- Implement `ensureSelectionForGroup(selections, group, allocator): Selection`
- Write tests for:
  - Selection creation with correct layer
  - Object add/remove behavior
  - Group-based selection lookup
  - Exclusive vs non-exclusive mode

### Subtask 2.3: Create `layerMaskManager.ts` with tests

- Implement `saveLayerMasks(obj: Object3D): void`
- Implement `restoreLayerMasks(obj: Object3D): void`
- Implement `enableMainPassLayer(obj: Object3D): void`
- Add type guard: `isMesh(obj: Object3D): obj is Mesh`
- Write tests for:
  - Layer mask preservation across save/restore
  - Nested object traversal
  - Main pass (layer 0) visibility
  - Cleanup of userData keys

### Subtask 2.4: Create `materialManager.ts` with tests

- Implement `saveColorWriteState(obj: Object3D): void`
- Implement `applyBloomColorWrite(obj: Object3D, enabled: boolean): void`
- Implement `restoreColorWriteState(obj: Object3D): void`
- Implement `syncColorWriteForObjects(objects: Iterable<Object3D>, enabled: boolean): void`
- Add helper: `hasForceColorWrite(material: Material): boolean`
- Write tests for:
  - Save/restore round-trip preserves values
  - Transparent materials get `colorWrite=false`
  - Force-write flag respected
  - Multi-material meshes handled
  - Disposed material edge case

### Subtask 2.5: Validate all tests pass

- Run `npm test -- --coverage src/renderer/bloom/`
- Verify >90% coverage on each module
- Run `npm run typecheck`

## Progress Tracking

**Overall Status:** Not Started — 0%

### Subtasks

| ID | Description | Status | Updated | Notes |
|----|-------------|--------|---------|-------|
| 2.1 | Create `layerAllocator.ts` with tests | Not Started | — | — |
| 2.2 | Create `selectionManager.ts` with tests | Not Started | — | — |
| 2.3 | Create `layerMaskManager.ts` with tests | Not Started | — | — |
| 2.4 | Create `materialManager.ts` with tests | Not Started | — | — |
| 2.5 | Validate coverage and typecheck | Not Started | — | — |

## Progress Log

_No progress yet._

## Acceptance Criteria

- [ ] `layerAllocator.ts` with >90% test coverage
- [ ] `selectionManager.ts` with >90% test coverage
- [ ] `layerMaskManager.ts` with >90% test coverage
- [ ] `materialManager.ts` with >90% test coverage
- [ ] No `any` casts except necessary Three.js interop
- [ ] All `/* ignore */` comments replaced with explicit handling
- [ ] `npm run typecheck` passes
- [ ] `npm test` passes

## Files to Create/Modify

**Create:**

- `src/renderer/bloom/layerAllocator.ts`
- `src/renderer/bloom/selectionManager.ts`
- `src/renderer/bloom/layerMaskManager.ts`
- `src/renderer/bloom/materialManager.ts`
- `test/vitest/renderer/bloom/layerAllocator.spec.ts`
- `test/vitest/renderer/bloom/selectionManager.spec.ts`
- `test/vitest/renderer/bloom/layerMaskManager.spec.ts`
- `test/vitest/renderer/bloom/materialManager.spec.ts`

**Modify:**

- None (these are new standalone modules)

## Dependencies

- [TASK114](TASK114-bloom-refactor-phase1-types-constants.md) — Types and constants must be extracted first

## Follow-up Tasks

- [TASK116](TASK116-bloom-refactor-phase3-provider.md) — Phase 3: Refactor BloomProvider component
