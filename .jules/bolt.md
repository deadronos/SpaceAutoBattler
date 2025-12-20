# Bolt's Journal

## 2024-05-22 - [Optimizing Homing Projectile Target Lookup]

**Learning:** `findShipById` had a redundant O(N) fallback that was triggered whenever a target ship was dead (missing from map), causing significant performance degradation (100x slower) in the exact moment when combat is intense (ships dying).
**Action:** Trust the canonical state maps (`shipById`) and avoid expensive linear search fallbacks when the map lookup is authoritative.

## 2024-05-22 - [Zero-Allocation Projectile Physics Updates]

**Learning:** `advanceProjectiles` was creating 2 closures per projectile per frame to defer physics updates, resulting in thousands of allocations and GC pressure.
**Action:** Use persistent TypedArrays and batched updates (via `WeakMap<GameState, Buffers>`) to eliminate per-projectile allocations in hot loops.

## 2024-05-22 - [Optimizing Turret Targeting Logic]
**Learning:** Turret targeting was performing two full O(N) scans when a priority target was sought: one for "nearest enemy" (fallback) and one for the priority target.
**Action:** Inverted the logic to scan for priority targets first. If a target is found, the generic "nearest enemy" scan is skipped. If no priority target is found, the fallback scan is executed to ensure the turret still fires. This reduced turret update time by ~25% in benchmarks.
