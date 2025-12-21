---
title: Replace Math.random() in ParticleTrails for Determinism
labels: ["code-quality", "determinism", "priority: low"]
---

## Summary
Replace `Math.random()` usage in ParticleTrails with `SeededRng` to maintain determinism and replay consistency.

## Context
From performance review v2.0.5g (TASK160):

**File**: `src/components/ParticleTrails.tsx`

**Current issues**:
- Uses `Math.random()` in fallback path (non-deterministic)
- Occasional `clone()` calls in fallback (minor allocation overhead)
- Breaks deterministic replay when fallback is triggered

This is a **minor issue** with low performance impact but affects the determinism guarantees that the rest of the codebase maintains.

## Implementation Plan

1. **Add SeededRng to Component**
   - Use `state.rng` from GameState or create component instance
   - Pass RNG through props or context as needed

2. **Replace Math.random() Calls**
   - Find all `Math.random()` usage in fallback paths
   - Replace with `rng.next()` or appropriate RNG method

3. **Replace Vector3 Clones**
   - Identify `clone()` calls in hot paths
   - Preallocate module-level temp vectors
   - Reuse temps instead of allocating

4. **Add Test Coverage**
   - Test deterministic behavior with fixed seed
   - Validate replay consistency
   - Ensure fallback path still works correctly

5. **Validate with Scenarios**
   - Run AI scenario harness
   - Confirm no regression in visual quality
   - Verify determinism maintained

## Priority
**Low Impact / Low Effort** - Code quality improvement for determinism consistency.

## Acceptance Criteria
- [ ] No `Math.random()` usage in ParticleTrails component
- [ ] All randomness uses `SeededRng` from game state
- [ ] Temp vectors preallocated and reused (no per-frame `clone()`)
- [ ] Tests added for deterministic behavior
- [ ] Replay consistency validated
- [ ] Visual quality unchanged

## Technical Notes
- Follow existing patterns in motion system and AI code for temp vector reuse
- Use `state.rng` to maintain consistency with rest of simulation
- Ensure fallback path still provides reasonable visuals

## References
- Performance Review: `docs/performance-review-v2.0.5g.md`
- Task Details: `memory/tasks/TASK160-particle-trail-determinism.md`
- Best Practices: `docs/performance-best-practices.md`
