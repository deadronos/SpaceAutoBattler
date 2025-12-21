# [TASK160] Replace Math.random() in ParticleTrails

**Status:** Pending  
**Added:** 2025-12-21  
**Updated:** 2025-12-21

## Original Request

From performance review v2.0.5g: Replace Math.random() usage in ParticleTrails with SeededRng for determinism and replay consistency.

## Context

File: `src/components/ParticleTrails.tsx`

Current issue:
- Uses `Math.random()` in fallback path
- Occasional `clone()` calls in fallback
- Breaks deterministic replay when fallback is triggered

This is a minor issue with low performance impact but affects determinism guarantees.

## Implementation Plan

1. Add SeededRng instance to ParticleTrails component
2. Replace Math.random() calls with rng.next()
3. Replace Vector3 clones with temp vector reuse
4. Add test coverage for deterministic behavior
5. Validate replay consistency

## Priority

**Low Impact / Low Effort** - Code quality improvement for determinism.

## Progress Tracking

**Overall Status:** Not Started

### Subtasks

| ID  | Description           | Status                                     | Updated | Notes                |
| --- | --------------------- | ------------------------------------------ | ------- | -------------------- |
| 3.1 | Add SeededRng to component | Not Started | 2025-12-21 | Use state.rng or create instance |
| 3.2 | Replace Math.random() calls | Not Started | 2025-12-21 | Use rng.next() |
| 3.3 | Replace Vector3 clones | Not Started | 2025-12-21 | Preallocate temp vectors |
| 3.4 | Add determinism tests | Not Started | 2025-12-21 | Test replay consistency |
| 3.5 | Validate with scenarios | Not Started | 2025-12-21 | Run AI scenario harness |

## Progress Log

### 2025-12-21
- Task created from performance review v2.0.5g
- Identified as determinism improvement opportunity
