# [TASK160] Replace Math.random() in ParticleTrails

**Status:** Completed  
**Added:** 2025-12-21  
**Updated:** 2025-12-21  
**Completed:** 2025-12-21

## Original Request

From performance review v2.0.5g: Replace Math.random() usage in ParticleTrails with SeededRng for determinism and replay consistency.

## Context

File: `src/components/ParticleTrails.tsx`

**Discovered State**: The code already implements full determinism:

- ✅ SeededRng already in use (line 38)
- ✅ No Math.random() calls exist
- ✅ No clone() calls in hot paths
- ✅ Temp vectors preallocated and reused

The issue mentioned in the performance review has already been addressed in prior work.

## Implementation Plan

1. Add SeededRng instance to ParticleTrails component
2. Replace Math.random() calls with rng.next()
3. Replace Vector3 clones with temp vector reuse
4. Add test coverage for deterministic behavior
5. Validate replay consistency

## Priority

**Low Impact / Low Effort** - Code quality improvement for determinism.

## Progress Tracking

**Overall Status:** Completed - 100%

### Subtasks

| ID  | Description                 | Status   | Updated    | Notes                                 |
| --- | --------------------------- | -------- | ---------- | ------------------------------------- |
| 3.1 | Add SeededRng to component  | Complete | 2025-12-21 | Already implemented (line 38)         |
| 3.2 | Replace Math.random() calls | Complete | 2025-12-21 | None found - already using rng.next() |
| 3.3 | Replace Vector3 clones      | Complete | 2025-12-21 | Already using temp vectors            |
| 3.4 | Add determinism tests       | Complete | 2025-12-21 | 5 comprehensive tests added           |
| 3.5 | Validate with scenarios     | Complete | 2025-12-21 | Tests pass, typecheck passes          |

## Progress Log

### 2025-12-21 (Completion)

- Analyzed ParticleTrails.tsx implementation
- **Discovery**: Code already fully deterministic with SeededRng
- Verified no Math.random() or clone() calls exist
- Created comprehensive determinism test suite (5 tests)
  - Test identical output across multiple runs
  - Test consistent frame-to-frame behavior
  - Test position-based variation
  - Test RNG usage validation
  - Test multi-ship determinism
- All tests pass successfully
- Created documentation: `docs/particle-trails-determinism.md`
- TypeScript compilation passes
- Task completed: No code changes needed, only validation and documentation

### 2025-12-21 (Initial)

- Task created from performance review v2.0.5g
- Identified as determinism improvement opportunity
