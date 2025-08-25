# Performance Analysis and Recommendations

This document analyses performance bottlenecks observed in the `dev` branch of the SpaceAutoBattler project (focus on `src/gamemanager.ts`, simulation loop, pooling, and renderer interaction) and provides prioritized actionable recommendations and tests.

## Executive summary

- Main hot paths: simulation fixed-step loop, renderer coupling, particle/explosion generation, and per-frame Map/array rebuilds.
- Real-world symptoms: CPU spikes during catch-up frames, redundant renders per-frame, potential unbounded growth of global event arrays (flashes/particles) when pooling/release is inconsistent, and excessive O(n) work (map rebuilds) on every frame or snapshot.
- Highest-impact fixes: (1) move rendering out of per-step logic so the renderer runs once per RAF, (2) throttle/coalesce worker snapshot-driven renders, (3) audit and harden pooling lifecycle to avoid leaks/double-free, (4) avoid rebuilding shipMap every frame.

## Findings (detailed)

1. Run loop and fixed-step catch-up

- The manager uses an accumulator pattern in `runLoop()` and calls `step()` inside a while loop until accumulated time is consumed. Each `step()` currently runs simulation _and_ calls `renderer.renderState()` when no worker is used.
- When the game lags, `acc` may contain several simulation steps (bounded by a clamp but still large), causing `step()` to be executed multiple times in a tight loop and invoking `renderer.renderState()` repeatedly inside the same animation frame. That produces CPU spikes and poor visual smoothness.

2. Rendering and worker snapshot coupling

- In worker mode the snapshot handler calls `renderer.renderState()` immediately for each snapshot received. If snapshots arrive faster than the renderer can paint (or than RAF), renders will queue and block the main thread.
- No coalescing/back-pressure is used; the main thread renders every snapshot as it arrives.

3. Pooling inconsistencies and event array growth

- Pools exist (bullets, effects, particles) and helpers like `acquireParticle` push items to `state.particles`. Release functions sometimes set `.alive`/`._pooled` flags; others omit them or swallow errors inconsistently.
- `simulate()` appends freshly-created explosion effects to a module-level `flashes` array, and similarly for shield/health flashes. If these arrays are not cleared/consumed consistently by the renderer, they can grow indefinitely.
- Particle spawn rate per-explosion is high (e.g., 12 particles per explosion), which multiplies memory churn when explosions are dense.

4. Per-frame O(n) rebuilds

- `simulate()` and worker snapshot handling rebuild `shipMap` by iterating `state.ships` to create a new Map each time. Recreating large Maps every frame scales linearly with number of ships and is avoidable.

5. Other perf anti-patterns

- Frequent arr.slice() on listener arrays (emit) allocates temporary arrays per emit; small but notable under high emit rate.
- Excessive try/catch blocks in hot paths may mask exceptions and add runtime overhead.

## Concrete prioritized TODO (with hints for fixes)

1. Prevent rendering inside tight multi-step catch-up

- Mark as high priority.
- Move `renderer.renderState()` out of `step()` so that runLoop calls renderState once per animation frame after processing all accumulated steps.
- Hint: change step() to only update state, and in runLoop after the while loop call renderer.renderState once, using the latest state (or the worker snapshot when worker mode).

2. Throttle renderer when using worker snapshots

- High priority.
- Throttle or drop snapshot-triggered renders if the previous render is still in progress or if frames are arriving faster than RAF. Use a lastRender timestamp or requestAnimationFrame-based flag to coalesce renders.
- Hint: on snapshot, set a "pendingSnapshot" flag and schedule a single RAF to render the latest snapshot.

3. Ensure pooling is consistent and bug-free

- High priority.
- Audit `acquire*` / `release*` functions to enforce consistent lifecycle: set .alive = true on acquire, set .alive = false and .\_pooled = true on release, remove from active arrays in release, and guard against double release.
- Hint: centralize pool release logic in `entities.*` functions; have manager helpers call those and avoid manual arr.splice duplications.

4. Avoid building shipMap every frame

- Medium priority.
- Maintain incremental shipMap updates: when ships are added/removed update the map; avoid recreating per-frame. Only rebuild when a structural change occurs.
- Hint: patch createShip and destroy logic to call shipMap.set / shipMap.delete and keep consistent across worker snapshot handler (only rebuild when snapshot indicates ids changed).

5. Reduce per-frame allocations/copies

- Medium priority.
- Avoid arr.slice() in emitManagerEvent on hot paths unless needed. Instead iterate over array and handle concurrent mutation by defensive checks or store a small generation number.
- Hint: if listeners may modify array during iteration, copy but try to minimize frequency (e.g., only copy if length>0 and emit rate high).

6. Bound particle/explosion spawn rate and add pooling back-pressure

- Medium priority.
- Limit number of particles per explosion or globally per-frame; reuse pooled particles instead of allocating new ones; ensure TTL-based pruning works and pool size caps exist.
- Hint: maintain a maxParticles active count and drop extra spawns or reuse oldest particle.

7. Ensure global arrays are pruned and not duplicated

- Medium priority.
- Confirm that simulation prunes event arrays; ensure manager-level arrays (flashes, shieldFlashes, healthFlashes) are cleared or rotated after renderer consumes them. For long-running sessions ensure arrays don't accumulate.
- Hint: have renderer consume and clear flashes after rendering, or move flashes to state and let simulate handle lifecycle.

8. Add diagnostics to detect leaks and hotspots

- Medium priority.
- Instrument counts (ships.length, bullets.length, particles.length, pool sizes) periodically and log if growth is monotonic. Add unit tests that run long simulations to detect leaks.
- Hint: add a debug mode with periodic heap snapshots or simple counters and alerts.

9. Review spatialGrid & collision complexity

- Medium priority.
- Confirm spatialGrid rebuild cost; prefer incremental updates or a loose grid with amortized cost. Optimize collision checks to avoid O(n^2).
- Hint: if grid is rebuilt fully each frame, profile and consider incremental insertion/removal only when objects move past cell boundaries.

10. Reduce try/catch in hot loops & unify error handling

- Low priority.
- Excessive try/catch around hot code paths can add overhead and mask errors. Remove or narrow-scoped try/catch in inner loops; log or surface errors during development.
- Hint: use a dev assert mode that allows exceptions to propagate in dev builds and swallow in production builds.

## Quick tests to run (manual)

- Run a stress sim with increasing ship counts (e.g., 100, 500, 1k) and measure:
  - main thread CPU and average frame time.
  - memory (heap) growth over 60s.
  - active counts of pools and arrays (`ships.length`, `particles.length`, `bullets.length`, `flashes.length`).
- Run with `useWorker: false` and `true` to compare behavior and snapshot rate.
- Add a long-running test that spawns explosions and particles continuously and assert that particles.length stabilizes (does not grow unbounded).

## Final notes / next steps

- Immediate highest-impact change: move rendering out of per-step to once-per-frame and add snapshot render throttling. That will reduce redundant renders and smooth CPU usage.
- Follow-up: audit and tighten pooling lifecycle and limiting particle spawn rates to prevent leaks.
- If you want, I can implement the recommended changes (runLoop/step refactor and worker snapshot coalescing), add debug counters, and add unit tests. Respond "implement" and I will prepare and apply the patch and run tests.
