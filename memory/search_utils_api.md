# Search Utilities API Summary

File: src/core/searchUtils.ts

Purpose
- Provide small, shared search utilities used by AI and game logic. Functions prefer the spatial grid (state.spatialGrid) when enabled, but fall back to linear scans so behavior remains consistent regardless of configuration.

Exports
- getDistance(a: Vector3, b: Vector3): number
  - Returns Euclidean distance between two 3D points.

- findNearestEnemy(state: GameState, ship: Ship): Ship | null
  - Uses spatialGrid.queryKNearest when state.spatialGrid is available and enabled, otherwise falls back to linear search.
  - Returns closest enemy ship or null when none found.

- findNearbyEnemies(state: GameState, ship: Ship, range: number): Ship[]
  - When spatial grid enabled: ensures grid is populated (`ensureSpatialGridPopulated`), then queries entities within radius and maps to Ship objects. Returns sorted by distance.
  - Fallback: linear scan over state.ships filtering by enemy team and range, then sorts by distance.

- findNearbyFriends(state: GameState, ship: Ship, range: number): Ship[]
  - Same pattern as findNearbyEnemies but filters for friend team and excludes the calling ship.

- getNearbySeparationShipsLinear(state: GameState, ship: Ship, separationDistance: number): Ship[]
  - Linear-only helper used by separation logic. Returns friendly ships within separationDistance (excluding self), not using spatialGrid.

Behavioral Notes & Testing Guidance
- ensureSpatialGridPopulated(state): internal helper that rebuilds spatialGrid snapshot from state.ships before queries. This avoids stale grid state when queries run out-of-band from main update pass.
- Spatial grid path vs linear path: Behavior should be identical functionally; tests should assert correctness in both modes by toggling `behaviorConfig.globalSettings.enableSpatialIndex`.
- Determinism: getDistance is pure. findNearestEnemy/friends/enemies rely on state.ships contents and state.shipIndex; to test determinism, create a seeded GameState via createInitialState(seed) and populate known ship positions.

Suggested Tests
- With spatial grid disabled: create two teams with known positions, verify findNearestEnemy returns the expected ship.
- With spatial grid enabled: same test but ensure `state.spatialGrid` exists; findNearestEnemy should match linear result.
- findNearbyEnemies returns ships only within range and sorted by distance.
- getNearbySeparationShipsLinear returns friendly ships within separation distance and excludes the caller.

Memory: search_utils_api (written)
