# DESIGN061: BloomProvider Refactor into Smaller Modules

**Status:** Completed  
**Created:** 2025-11-24  
**Completed:** 2025-11-24  
**Priority:** Medium  
**Complexity:** Medium  
**Estimated Effort:** 1-2 days

## Problem Statement

The `BloomProvider.tsx` component has grown to 350+ lines and handles multiple concerns:
1. Layer allocation for Three.js bloom selections
2. Object registration/unregistration with the bloom system
3. Material colorWrite management (save/restore patterns)
4. Layer mask preservation and restoration
5. Enabled state synchronization across all registered objects

This complexity makes the component difficult to test, maintain, and extend. The heavy use of `try-catch { /* ignore */ }` blocks suggests fragile code paths that mask underlying issues.

## Goals

1. **Separation of Concerns**: Split into focused, single-responsibility modules
2. **Testability**: Enable unit testing of layer allocation and material management independently
3. **Error Clarity**: Replace silent catch blocks with explicit error handling
4. **Type Safety**: Eliminate `any` casts where possible
5. **Documentation**: Document the layer allocation strategy and colorWrite behavior

## Non-Goals

- Changing the public API of `BloomProvider` or `useBloomRegistration`
- Altering the visual behavior of selective bloom
- Performance optimization (separate concern)

## Current Architecture Analysis

### File: `src/renderer/BloomProvider.tsx` (~350 LOC)

```text
BloomProvider.tsx
├── Types & Constants
│   ├── BloomRegistrationOptions
│   ├── BloomCtx
│   └── LAYER_START, FALLBACK_GROUP
├── Helper Functions
│   └── normalizeLayerIndex()
├── BloomProvider Component
│   ├── Refs (selections, objectGroup, nextLayer)
│   ├── Effect: Initialize selections for configured groups
│   ├── Callback: register() [~80 lines]
│   │   ├── Group management
│   │   ├── Selection creation
│   │   ├── Layer mask preservation
│   │   └── ColorWrite management
│   ├── Callback: unregister() [~50 lines]
│   │   ├── Selection removal
│   │   ├── ColorWrite restoration
│   │   └── Layer mask restoration
│   ├── Effect: Sync colorWrite on enabled toggle [~40 lines]
│   └── Context value with utility methods
└── Hooks
    ├── useBloomContext()
    └── useBloomRegistration()
```

### Identified Concerns

| Concern | Current Location | Lines | Complexity |
|---------|-----------------|-------|------------|
| Layer allocation | `register()`, `useEffect` | ~30 | Medium |
| Selection management | `register()`, `unregister()` | ~25 | Low |
| ColorWrite management | `register()`, `unregister()`, `useEffect` | ~80 | High |
| Layer mask backup/restore | `register()`, `unregister()` | ~40 | Medium |
| Object-to-group tracking | Throughout | ~15 | Low |

## Proposed Architecture

### Module Structure

```text
src/renderer/bloom/
├── index.ts                    # Public re-exports
├── BloomProvider.tsx           # Slim provider (~100 LOC)
├── types.ts                    # Shared types and interfaces
├── constants.ts                # Configuration constants
├── layerAllocator.ts           # Layer index allocation logic
├── selectionManager.ts         # Selection creation and tracking
├── materialManager.ts          # ColorWrite save/restore utilities
├── layerMaskManager.ts         # Layer mask preservation utilities
└── __tests__/
    ├── layerAllocator.spec.ts
    ├── selectionManager.spec.ts
    ├── materialManager.spec.ts
    └── layerMaskManager.spec.ts
```

### Module Responsibilities

#### 1. `types.ts`

```typescript
import type { Camera, Object3D, Material } from 'three';
import type { Selection } from 'postprocessing';

export interface BloomRegistrationOptions {
  group?: string;
  active?: boolean;
}

export interface BloomContextValue {
  enabled: boolean;
  defaultGroup: string;
  selections: Map<string, Selection>;
  register: (obj: Object3D | null | undefined, options?: BloomRegistrationOptions) => void;
  unregister: (obj: Object3D | null | undefined) => void;
  getSelectionLayerMask: () => number;
  enableCameraLayers: (camera: Camera) => number;
}

export interface LayerAllocatorState {
  nextLayer: number;
  allocatedLayers: Map<string, number>;
}

export interface MaterialColorWriteState {
  originals: Map<Material, boolean | undefined>;
}
```

#### 2. `constants.ts`

```typescript
import { POSTPROCESSING_CONFIG } from '../../config/renderer.js';

export const LAYER_START = POSTPROCESSING_CONFIG.bloomLayerStart ?? 11;
export const LAYER_MAX = 31;
export const FALLBACK_GROUP = 'default';
export const BLOOM_ORIG_LAYER_KEY = '__bloom_origLayerMask';
export const BLOOM_ORIG_COLORWRITE_KEY = '__bloom_origColorWrite';
```

#### 3. `layerAllocator.ts`

Pure functions for layer index management:

```typescript
export function normalizeLayerIndex(value: unknown, fallback: number): number;
export function allocateLayer(state: LayerAllocatorState, group: string): number;
export function computeLayerMask(selections: Map<string, Selection>): number;
```

**Tests:**
- Validate layer clamping to `[0, 31]`
- Verify allocation increments
- Test mask computation for multiple selections

#### 4. `selectionManager.ts`

Selection lifecycle management:

```typescript
export function createSelection(layer: number, exclusive?: boolean): Selection;
export function addObjectToSelection(selection: Selection, obj: Object3D): void;
export function removeObjectFromSelection(selection: Selection, obj: Object3D): void;
export function ensureSelectionForGroup(
  selections: Map<string, Selection>,
  group: string,
  allocator: LayerAllocatorState
): Selection;
```

**Tests:**
- Selection creation with correct layer assignment
- Object add/remove behavior
- Group-based selection lookup

#### 5. `materialManager.ts`

ColorWrite flag management:

```typescript
export function saveColorWriteState(obj: Object3D): void;
export function applyBloomColorWrite(obj: Object3D, enabled: boolean): void;
export function restoreColorWriteState(obj: Object3D): void;
export function syncColorWriteForObjects(
  objects: Iterable<Object3D>,
  enabled: boolean
): void;
```

**Tests:**
- Save/restore round-trip preserves original values
- Transparent materials get colorWrite=false when enabled
- Force-write flag is respected
- Multi-material meshes handled correctly

#### 6. `layerMaskManager.ts`

Layer mask preservation:

```typescript
export function saveLayerMasks(obj: Object3D): void;
export function restoreLayerMasks(obj: Object3D): void;
export function enableMainPassLayer(obj: Object3D): void;
```

**Tests:**
- Layer mask preservation across register/unregister
- Main pass (layer 0) visibility maintained

#### 7. `BloomProvider.tsx` (Refactored)

Slim orchestration component (~100 LOC):

```typescript
import { createContext, useContext, useCallback, useEffect, useMemo, useRef } from 'react';
import type { Object3D, Camera } from 'three';
import type { Selection } from 'postprocessing';
import { POSTPROCESSING_CONFIG } from '../../config/renderer.js';
import type { BloomContextValue, BloomRegistrationOptions, LayerAllocatorState } from './types.js';
import { FALLBACK_GROUP, LAYER_START } from './constants.js';
import { allocateLayer, computeLayerMask, normalizeLayerIndex } from './layerAllocator.js';
import { ensureSelectionForGroup, addObjectToSelection, removeObjectFromSelection } from './selectionManager.js';
import { saveColorWriteState, applyBloomColorWrite, restoreColorWriteState, syncColorWriteForObjects } from './materialManager.js';
import { saveLayerMasks, restoreLayerMasks, enableMainPassLayer } from './layerMaskManager.js';

const BloomContext = createContext<BloomContextValue | null>(null);

export function BloomProvider({ enabled, children }: { enabled: boolean; children?: React.ReactNode }) {
  // State refs
  const selectionsRef = useRef<Map<string, Selection>>(new Map());
  const objectGroupRef = useRef<Map<Object3D, string>>(new Map());
  const allocatorRef = useRef<LayerAllocatorState>({
    nextLayer: LAYER_START,
    allocatedLayers: new Map(),
  });

  const defaultGroup = POSTPROCESSING_CONFIG.bloomDefaultGroup ?? FALLBACK_GROUP;

  // Initialize selections for configured groups
  useEffect(() => {
    const groups = POSTPROCESSING_CONFIG.bloomGroups ?? {};
    const allGroups = [...new Set([...Object.keys(groups), defaultGroup])];
    
    for (const group of allGroups) {
      ensureSelectionForGroup(selectionsRef.current, group, allocatorRef.current);
    }
  }, [defaultGroup]);

  // Registration callback
  const register = useCallback((obj: Object3D | null | undefined, options?: BloomRegistrationOptions) => {
    if (!obj) return;
    
    const isActive = options?.active ?? true;
    const group = options?.group ?? defaultGroup;
    const previousGroup = objectGroupRef.current.get(obj);

    // Handle deactivation
    if (!isActive) {
      if (previousGroup) {
        removeObjectFromSelection(selectionsRef.current.get(previousGroup)!, obj);
        restoreColorWriteState(obj);
        restoreLayerMasks(obj);
        objectGroupRef.current.delete(obj);
      }
      return;
    }

    // Handle group change
    if (previousGroup && previousGroup !== group) {
      removeObjectFromSelection(selectionsRef.current.get(previousGroup)!, obj);
    }

    // Register to new group
    objectGroupRef.current.set(obj, group);
    const selection = ensureSelectionForGroup(selectionsRef.current, group, allocatorRef.current);
    
    saveLayerMasks(obj);
    saveColorWriteState(obj);
    addObjectToSelection(selection, obj);
    enableMainPassLayer(obj);
    
    if (enabled) {
      applyBloomColorWrite(obj, true);
    }
  }, [defaultGroup, enabled]);

  // Unregistration callback
  const unregister = useCallback((obj: Object3D | null | undefined) => {
    if (!obj) return;
    
    const group = objectGroupRef.current.get(obj);
    if (!group) return;

    const selection = selectionsRef.current.get(group);
    if (selection) {
      removeObjectFromSelection(selection, obj);
    }
    
    restoreColorWriteState(obj);
    restoreLayerMasks(obj);
    objectGroupRef.current.delete(obj);
  }, []);

  // Sync colorWrite when enabled toggles
  useEffect(() => {
    syncColorWriteForObjects(objectGroupRef.current.keys(), enabled);
  }, [enabled]);

  // Context value
  const value = useMemo<BloomContextValue>(() => ({
    enabled,
    defaultGroup,
    selections: selectionsRef.current,
    register,
    unregister,
    getSelectionLayerMask: () => computeLayerMask(selectionsRef.current),
    enableCameraLayers: (camera: Camera) => {
      const prev = camera.layers.mask;
      camera.layers.mask = prev | computeLayerMask(selectionsRef.current);
      return prev;
    },
  }), [enabled, defaultGroup, register, unregister]);

  return <BloomContext.Provider value={value}>{children}</BloomContext.Provider>;
}

export function useBloomContext(): BloomContextValue | null {
  return useContext(BloomContext);
}

export function useBloomRegistration<T extends Object3D>(
  ref: React.RefObject<T | null>,
  options?: BloomRegistrationOptions
): void {
  const ctx = useBloomContext();

  useEffect(() => {
    const obj = ref.current;
    if (!ctx || !obj) return;

    const isActive = options?.active ?? true;
    if (!isActive) {
      ctx.unregister(obj);
      return;
    }

    ctx.register(obj, options);
    return () => ctx.unregister(obj);
  }, [ctx, ref, options?.group, options?.active]);
}
```

## Error Handling Strategy

Replace silent `catch { /* ignore */ }` with categorized handling:

```typescript
// In materialManager.ts
export function applyBloomColorWrite(obj: Object3D, enabled: boolean): void {
  obj.traverse((child) => {
    if (!isMesh(child)) return;
    
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const mat of materials) {
      if (!mat || typeof mat !== 'object') continue;
      
      // Skip materials marked with force-write flag
      if (hasForceColorWrite(mat)) continue;
      
      // Only modify transparent materials
      if (!mat.transparent) continue;
      
      try {
        mat.colorWrite = !enabled;
      } catch (err) {
        // Material may be disposed or read-only in some edge cases
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[BloomProvider] Failed to set colorWrite:', err);
        }
      }
    }
  });
}
```

## Migration Plan

### Phase 1: Extract Types and Constants (1 hour)
1. Create `src/renderer/bloom/types.ts`
2. Create `src/renderer/bloom/constants.ts`
3. Update imports in `BloomProvider.tsx`

### Phase 2: Extract Pure Logic (2-3 hours)
1. Create `layerAllocator.ts` with tests
2. Create `materialManager.ts` with tests
3. Create `layerMaskManager.ts` with tests
4. Create `selectionManager.ts` with tests

### Phase 3: Refactor BloomProvider (1-2 hours)
1. Rewrite `BloomProvider.tsx` to use extracted modules
2. Verify existing behavior unchanged
3. Add integration tests

### Phase 4: Cleanup (30 minutes)
1. Create `index.ts` with public exports
2. Update external imports
3. Remove duplicate code
4. Update documentation

## Testing Strategy

### Unit Tests

| Module | Test Focus | Coverage Target |
|--------|-----------|-----------------|
| `layerAllocator` | Edge cases, bounds | 100% |
| `materialManager` | Multi-material, force-write | 100% |
| `layerMaskManager` | Traversal, restoration | 100% |
| `selectionManager` | Creation, add/remove | 100% |

### Integration Tests

1. **Register/Unregister Round-Trip**: Verify objects return to original state
2. **Enabled Toggle**: Confirm colorWrite syncs correctly
3. **Multi-Group**: Test objects moving between groups
4. **Edge Cases**: Null objects, disposed materials, invalid layers

### Visual Regression Tests

1. **Bloom Appearance**: Screenshot comparison with/without bloom
2. **Toggle Behavior**: Verify no visual glitches on enable/disable
3. **Multi-Object Scene**: Multiple bloom groups rendering correctly

## Acceptance Criteria

1. [x] `BloomProvider.tsx` reduced to ~100 LOC
2. [x] All extracted modules have >90% test coverage
3. [x] No `any` casts in new code (except necessary Three.js interop)
4. [x] All `/* ignore */` comments replaced with explicit handling
5. [x] Public API unchanged (`useBloomContext`, `useBloomRegistration`)
6. [ ] Visual behavior identical (verified by screenshot tests) — deferred to manual testing
7. [x] No new console warnings in normal operation
8. [x] Documentation updated for layer allocation strategy

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking visual behavior | High | Visual regression tests before/after |
| Performance regression | Medium | Benchmark registration/unregistration |
| React rendering issues | Medium | Test with StrictMode double-effects |
| Three.js version coupling | Low | Abstract traversal/material access |

## Open Questions

1. Should we expose `LayerAllocatorState` for advanced use cases?
2. Is there value in making the colorWrite behavior configurable per-group?
3. Should we add telemetry for layer allocation exhaustion (hitting layer 31)?

## Related Documents

- [DESIGN048](DESIGN048-renderer-large-file-plan.md) — Broader renderer refactoring context
- [DESIGN049](DESIGN049-renderer-config-refactor.md) — Config refactoring that affects bloom groups
- High-level architecture review identified this as a medium-priority improvement

---

*This design follows the repository's spec-driven workflow. Implementation should update `memory/tasks/` with progress.*
