# Pull Request: Refactor - Centralize Instanced Layer Manager

## Executive Summary

**Goal**: Unify repeated instanced rendering logic into a single, strongly-typed manager and migrate the explosion system and related updaters to a per-instance allocator model to improve maintainability, reduce duplication, and fix subtle allocation bugs.

**Branch**: `copilot/refactor-instanced-layer-manager`  
**Target**: `main`  
**Status**: DRAFT - Ready for Review  
**Type**: Refactor  

## What Changed (High-Level)

- **Introduced** a canonical `InstancedLayerManager` abstraction for managing Three.js instanced meshes and their per-frame lifecycle (allocation, setMatrix/setColor, release/endFrame, dispose)
- **Added** `src/components/layers/types.ts` as a neutral, type-only interface to avoid circular imports while keeping strong typing for effect updaters
- **Migrated** all explosion effect updaters (flash, shockwave, fireball, debris, sparks, plasma, smoke) from contiguous startIndex/commit semantics to allocator semantics (allocate(key) -> setMatrixAt/setColorAt)
- **Consolidated** duplicate `HIDDEN_MATRIX` constants into the canonical export from `instancedLayer.ts` and updated references
- **Tightened** typings (removed `any`) across updaters by using the neutral manager type
- **Added** unit tests for the `InstancedLayerManager` covering allocation/release, saturation, endFrame semantics, and null-mesh safety
- **Updated** existing tests to accommodate allocator semantics where necessary and kept backward-compatible finalize behavior

## Files Touched

### Core Infrastructure
- **Added**: `src/components/layers/types.ts` - Neutral interface for type-only imports
- **Modified**: `src/components/layers/instancedLayer.ts` - InstancedLayerManager implementation and HIDDEN_MATRIX export
- **Modified**: `src/components/debris/DebrisInstancedManager.ts` - Updated HIDDEN_MATRIX import

### Explosion System
- **Modified**: `src/components/explosions/instancedManager.ts` - Per-effect managers using InstancedLayerManager
- **Modified**: `src/components/explosions/ExplosionRendererCore.tsx` - Updater invocation using allocator semantics
- **Modified**: All effect updaters:
  - `src/components/explosions/effectUpdaters/flashUpdater.ts`
  - `src/components/explosions/effectUpdaters/shockwaveUpdater.ts`
  - `src/components/explosions/effectUpdaters/fireballUpdater.ts`
  - `src/components/explosions/effectUpdaters/debrisUpdater.ts`
  - `src/components/explosions/effectUpdaters/sparksUpdater.ts`
  - `src/components/explosions/effectUpdaters/plasmaUpdater.ts`
  - `src/components/explosions/effectUpdaters/smokeUpdater.ts`
  - `src/components/explosions/effectUpdaters/types.ts`

### Tests
- **Added**: `test/components/layers/instancedLayerManager.spec.ts` - 4 edge-case tests
- **Modified**: Multiple explosion-related tests updated for allocator semantics:
  - `test/components/explosions/instancedManager.spec.ts`
  - All 7 effect updater test files in `test/components/explosions/effectUpdaters/`

## Validation Performed

### Type Checking ✅
```bash
npm run typecheck
# Result: PASSED - No type errors
```

### Test Suite ✅
```bash
npm test
# Result: PASSED - 110 test files, 561 tests
```

### Component-Specific Tests ✅
- InstancedLayerManager: 4/4 tests passed
  - Allocates lowest indices first and recycles released indices
  - endFrame reports released indices and maxIndex semantics
  - Saturates when capacity reached
  - Behaves safely when meshRef.current is null
- Explosion System: 59/59 tests passed
  - All effect updater tests pass with allocator semantics
  - Manager tests validate attach, commit, and finalize behavior

## Why This Change

1. **Reduces Duplication**: Multiple parts of the renderer used nearly-identical instanced allocation and lifecycle code. Centralizing reduces maintenance burden.

2. **Safer Allocation**: Allocator semantics (allocate/release) allow per-key mapping for dynamic effects where instances are created and destroyed at unpredictable times.

3. **Stronger Types**: Removed `any` types and introduced neutral type interface to prevent circular dependencies while maintaining type safety.

4. **Better Maintainability**: Single source of truth for instanced mesh management makes future changes easier and less error-prone.

## Architecture Benefits

- **Unified Interface**: All instanced mesh operations go through InstancedLayerManager
- **Allocation Awareness**: Manager reuses freed indices automatically
- **Type Safety**: Neutral type module breaks circular dependencies without losing type information
- **Test Coverage**: Comprehensive tests for edge cases (saturation, null meshes, index recycling)
- **Backward Compatible**: Finalize behavior preserved for existing consumers

## Review Notes for Maintainers

1. **Neutral Type Module**: `src/components/layers/types.ts` exists only to break circular type dependencies. Import concrete runtime functions (`createInstancedLayerManager`) when creating managers, and import the neutral type for type-only contexts.

2. **Backward Compatibility**: The PR preserves backward-compatibility in `instancedManager.finalize()` where existing tests and consumers relied on commit-count semantics. Consider simplifying after validating consumer behavior.

3. **Performance**: Manager is allocation-conscious and reuses indices where possible. No observable performance regressions in unit tests. Manual smoke testing recommended for complex scenes.

4. **HIDDEN_MATRIX**: Now exported from a single location (`instancedLayer.ts`). All references updated to use this central export.

## Acceptance Criteria for Merging

- ✅ All CI checks pass (typecheck, tests) - Validated locally
- ✅ No runtime regressions in rendering behavior - No test failures
- ✅ Type safety improved throughout - Removed `any` types
- ✅ Test coverage adequate - 63 tests for refactored components
- [ ] Reviewers confirm no visual regressions (quick smoke check recommended)

## Follow-Up Items (Optional)

Consider creating separate issues for:

1. Add assertions in `instancedLayerManager.spec.ts` to verify that released indices are overwritten with `HIDDEN_MATRIX` and hidden colors (read-back from mesh attributes)

2. Consider moving `src/components/layers/types.ts` to a more central location if other modules need these neutral types frequently

3. Add a short entry to `CHANGELOG.md` or `PR_NOTES/` describing migration steps for external consumers

4. Simplify `finalize()` backward-compatibility code after confirming all consumers work correctly

## Migration Guide for Reviewers

### Before (Old Pattern)
```typescript
// Manual allocation and matrix management
const startIndex = manager.getStartIndex('flash');
mesh.setMatrixAt(startIndex, matrix);
manager.commit('flash', { count: 1, saturated: false });
```

### After (New Pattern)
```typescript
// Allocator-based management
const idx = manager.allocate('flash:unique-key');
if (idx != null) {
  manager.setMatrixAt(idx, matrix);
  manager.setColorAt(idx, color);
}
```

## Testing Instructions

```bash
# Install dependencies
npm install

# Run type check
npm run typecheck

# Run all tests
npm test

# Run specific component tests
npm test -- test/components/layers/instancedLayerManager.spec.ts
npm test -- test/components/explosions/
```

## Labels

- `refactor`
- `tests-passing`
- `needs-review`
- `no-breaking-changes`

---

**Ready for Review**: This refactor consolidates instanced rendering logic, improves type safety, and provides comprehensive test coverage. All automated checks pass. Manual smoke testing recommended before merge.
