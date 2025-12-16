# Bolt's Journal

## 2024-05-22 - [Optimizing Homing Projectile Target Lookup]
**Learning:** `findShipById` had a redundant O(N) fallback that was triggered whenever a target ship was dead (missing from map), causing significant performance degradation (100x slower) in the exact moment when combat is intense (ships dying).
**Action:** Trust the canonical state maps (`shipById`) and avoid expensive linear search fallbacks when the map lookup is authoritative.
