# Performance Best Practices

This document outlines performance best practices for SpaceAutoBattler based on identified bottlenecks and successful optimizations.

## Core Principles

1. **Avoid allocations in hot paths**: Game systems run at 20 Hz (50ms per tick) with potential for 300+ entities. Minimize per-frame allocations.
2. **Prefer iteration over array methods**: Direct `for` loops with early exits outperform `filter()`, `map()`, and `reduce()` in performance-critical code.
3. **Use temp vectors**: Reuse Vector3/Quaternion instances via module-level `TMP_*` constants instead of allocating new objects.
4. **Early exit optimizations**: Check fail-fast conditions first to avoid expensive computations.

## Array Operations

### ❌ Avoid: filter() in hot paths

```typescript
// SLOW: Creates new array allocation per frame
const candidates = ships.filter((s) => s.ship.team !== ship.ship.team);
for (const s of candidates) {
  // process enemy ships
  }
```

## Simulation Diagnostics & Debug Controls

When investigating the main simulation loop (`BattlefieldSystems` → `updateGame`), use the debug UI controls (Wrench icon drawer) to toggle profiling guards and sampling without rebuilding the app.

- **Profile Subsystems** - Enables `performance.now()` measurements for each subsystem. Sampling defaults to every tick but can be throttled via the “Profiling sample rate” buttons (every 1..5 ticks). Higher values preserve data while reducing instrumentation pressure.
- **Subsystem Guards** - Wraps each subsystem in `runSafely`, which records diagnostic snapshots (via `safeSnapshot`) when exceptions occur. Leave this on during debugging; turn it off for trusted production runs to eliminate the guard overhead.
- **Profiling sample rate buttons** - Choose “Every tick” for full fidelity when profiling, or “Every Nth tick” to collect periodic samples while the simulation still runs close to full speed.

These runtime flags are mirrored directly to the simulation clock and do not require a reload. The defaults keep profiling disabled and guards enabled, but you can use the debug drawer to experiment with different sample rates depending on how much overhead you are willing to tolerate. If you need to keep `sim.maxSubSteps` predictable, note the UI-reported `BattlefieldSystems` clamp (1–5 steps per frame) before tweaking `timeScale` or `delta`.

### ✅ Prefer: Direct iteration with continue

```typescript
// FAST: No allocation, early skip
for (const s of ships) {
  if (s.ship.team === ship.ship.team) continue;
  // process enemy ships
}
```

### Manual Array Compaction

When you need to remove elements from an array in-place:

```typescript
// Instead of filter:
ship.muzzleFlashes = ship.muzzleFlashes.filter((m) => state.time - m.t0 < LIFETIME);

// Use manual compaction:
let writeIndex = 0;
for (let i = 0; i < ship.muzzleFlashes.length; i++) {
  if (state.time - ship.muzzleFlashes[i].t0 < LIFETIME) {
    ship.muzzleFlashes[writeIndex++] = ship.muzzleFlashes[i];
  }
}
ship.muzzleFlashes.length = writeIndex;
```

## Vector Math Optimizations

### ❌ Avoid: Allocating vectors in loops

```typescript
for (const ship of ships) {
  const direction = new Vector3().copy(target.position).sub(ship.position); // BAD
}
```

### ✅ Prefer: Reuse temp vectors

```typescript
const TMP_DIR = new Vector3(); // Module-level

for (const ship of ships) {
  TMP_DIR.copy(target.position).sub(ship.position); // GOOD
}
```

## Nested Loop Optimizations

### Sensor System Pattern

The sensor system demonstrates good O(N²) optimization:

```typescript
for (const source of ships) {
  for (const target of ships) {
    // Early exits reduce actual work:
    if (target === source) continue;
    if (target.ship.team === team) continue;
    if (distance > trackingRange) continue;
    if (angleFactor <= 0) continue;
    // ... only do expensive work for valid pairs
  }
}
```

**Key techniques:**
- Identity checks first (`target === source`)
- Cheap property checks next (`team`)
- Distance/angle checks before expensive operations
- Early `continue` to skip unnecessary work

## Performance Metrics

### Current Performance (as of 2025-10-31, v0.1.x)

- **AI Decision System**: ~1.5ms average per tick (300 ships, budget: 2.500ms)
- **Improvement from optimizations**: ~5% reduction from baseline

### Testing Performance

Run the AI budget test to validate optimizations:

```bash
npm run perf:ai-budget
```

Expected output (values will vary):
```
[ai-budget] ships=300 ticks=160 avgTick=~1.5ms budget=2.500ms
[ai-budget] PASS: average AI tick ~1.5ms within budget 2.500ms
```

## Common Pitfalls

1. **Set/Map creation in loops**: Pre-create lookup structures outside loops
2. **Distance calculations**: Use `distanceToSquared()` when possible to avoid `Math.sqrt()`
3. **Chained array methods**: `ships.filter().map().sort()` creates 3 temporary arrays
4. **Object destructuring in hot paths**: May cause hidden allocations in some engines

## Profiling Tools

### Node.js Profiling

For system-level code:
```bash
node --prof scripts/perf/assert-ai-budget.ts
node --prof-process isolate-*.log > profile.txt
```

### Browser Profiling

For renderer code:
1. Open DevTools Performance tab
2. Start recording
3. Run simulation for 10-20 seconds
4. Stop and analyze flame graph
5. Look for:
   - Long tasks (>16ms for 60 FPS)
   - Excessive GC (garbage collection)
   - Hot functions called thousands of times

## When to Optimize

### Optimize when:
- Profiling shows measurable impact (>2% of frame time)
- Code runs in game loop (per-frame or per-tick)
- Processing large collections (100+ entities)

### Don't optimize when:
- One-time initialization code
- Debug/UI code outside hot paths
- Premature optimization without measurements

## Future Optimization Opportunities

1. **Spatial partitioning**: Consider octree/BVH for sensor range checks if ship counts exceed 500
2. **Job system**: Parallelize independent system updates
3. **Instanced rendering**: Batch ships by hull type for GPU efficiency
4. **ECS improvements**: Leverage Miniplex query caching more extensively

## References

- [R3F/Drei Performance Best Practices](./r3f-drei-webgl-performance-best-practices.md)
- [Renderer Performance Report](./performance-report-v0.1.1.md)
- [Tech Debt Report](./tech-debt-report.md)

---

**Last Updated**: 2025-10-31  
**Validation**: All optimizations tested with `npm run typecheck && npm test && npm run perf:ai-budget`
