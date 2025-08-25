# SpaceAutoBattler Performance Analysis & Optimization Recommendations

## Executive Summary

Analysis of the dev branch reveals several performance bottlenecks affecting collision detection, AI ship lookups, and UI update patterns. The codebase has strong pooling and memory management, but a few hot paths cause unnecessary allocations and algorithmic overhead.

## Critical Performance Bottlenecks

### 1. O(n²) Collision Detection [CRITICAL]

**Location**: `src/simulate.ts:243-245`

```typescript
// Current implementation - O(n²)
for (let bi = (state.bullets || []).length - 1; bi >= 0; bi--) {
  const b = state.bullets[bi];
  for (let si = (state.ships || []).length - 1; si >= 0; si--) {
    const s = state.ships[si];
    if (s.team === b.team) continue;
    const r = (s.radius || 6) + (b.radius || 1);
    if (dist2(b, s) <= r * r) {
      // Collision handling...
    }
  }
}
```

**Impact**: With N ships and M bullets, this creates N×M distance checks per frame.

- 10 ships + 50 bullets = 500 distance checks
- 50 ships + 200 bullets = 10,000 distance checks

**Recommended Fix**: Use spatial partitioning (uniform grid or quadtree) to limit collision checks to nearby entities.

### 2. Inefficient Ship Lookup in AI [HIGH]

**Location**: `src/behavior.ts:138, 254`

Current code often searches `state.ships` linearly; replace with an O(1) lookup via `state.shipMap`.

Status: IMPLEMENTED — `shipMap` added to `GameState` and kept in sync; unit test `test/vitest/shipmap_sync.spec.ts` verifies correctness.

### 3. UI Array Operations in Hot Path [MEDIUM]

**Location**: `src/main.ts:347-349`

Problem: Filtering `state.ships` each frame creates temporary arrays and GC pressure.

Recommended fix: Cache per-team counts in `GameState` and update them incrementally on ship add/remove/team-change.

Status: IMPLEMENTED — `teamCounts` added to `GameState`; UI reads `state.teamCounts` instead of filtering. See `src/entities.ts`, `src/gamemanager.ts`, `src/simulate.ts`, `src/main.ts`. Tests: `test/vitest/teamcounts.spec.ts`, `test/vitest/team-switch.spec.ts`.

## Scaling Behavior Issues

### 4. Worker Callback Array Copying [MEDIUM]

Avoid copying callback arrays (`workerReadyCbs.slice()`) in hot paths — iterate directly.

### 5. Render State Object Creation [MEDIUM]

Reuse a `renderState` object instead of allocating a new object each frame.

## Memory Leak Risks

### 6. Timer Management [LOW-MEDIUM]

Ensure setTimeout IDs stored for cleanup are always cleared on error paths.

### 7. GPU Resource Management [LOW-MEDIUM]

Implement proper cleanup on WebGL context loss and explicit renderer shutdown.

## Implementation Priority

Phase 1 (Immediate - High Impact)

1. Spatial partitioning for collision detection
2. Ship lookup maps
3. UI team count caching

Phase 2 (Next - Medium Impact)

1. Worker callback optimization
2. Render state reuse
3. Timer cleanup hardening

Phase 3 (Later - Low Risk)

1. GPU resource cleanup

## Recommended Benchmarks

- Collision detection at 10/50/100/200 ships
- AI decision time with large fleets
- Memory usage over extended sessions
- Frame time consistency under load

## Measurement Strategy

1. Create baseline performance measurements
2. Add console.time/timeEnd around hot paths
3. Use Chrome DevTools Performance tab for memory profiling
4. Implement automated performance tests

## Architecture Notes

- ✅ Object pooling (bullets, particles, effects)
- ✅ Swap-pop optimizations for array removal
- ✅ Event system without array copying
- ✅ Fixed duplicate simulation calls
- ✅ Proper worker lifecycle management

These optimizations create a solid foundation. The recommended fixes address the remaining algorithmic complexity issues.
