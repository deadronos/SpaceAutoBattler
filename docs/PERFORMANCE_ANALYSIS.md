# SpaceAutoBattler Performance Analysis & Optimization Recommendations

## Executive Summary

Analysis of the dev branch reveals several performance bottlenecks that impact scaling behavior, particularly in collision detection, AI ship lookups, and UI update patterns. While the codebase has excellent object pooling and memory management in core areas, there are specific hot paths that create O(n²) complexity and unnecessary memory allocations.

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

**Impact**: With N ships and M bullets, this creates N×M distance calculations per frame.
- 10 ships + 50 bullets = 500 distance checks
- 50 ships + 200 bullets = 10,000 distance checks

**Recommended Fix**: Spatial partitioning using uniform grid or quadtree
```typescript
// Suggested implementation
class SpatialGrid {
  private cellSize: number;
  private grid: Map<string, Entity[]>;
  
  constructor(cellSize: number = 64) {
    this.cellSize = cellSize;
    this.grid = new Map();
  }
  
  insert(entity: Entity) {
    const cellX = Math.floor(entity.x / this.cellSize);
    const cellY = Math.floor(entity.y / this.cellSize);
    const key = `${cellX},${cellY}`;
    
    if (!this.grid.has(key)) this.grid.set(key, []);
    this.grid.get(key)!.push(entity);
  }
  
  queryRadius(x: number, y: number, radius: number): Entity[] {
    // Return only entities in nearby cells
  }
}
```

### 2. Inefficient Ship Lookup in AI [HIGH]

**Location**: `src/behavior.ts:138, 254`
```typescript
// Current - O(n) search per AI decision
turretTarget = (state.ships || []).find(
  (sh) => sh && sh.id === ship.__ai.targetId,
) || null;

target = (state.ships || []).find((sh) => sh && sh.id === ai.targetId) || null;
```

**Impact**: For N ships, each making AI decisions = N×N lookups per frame
**Recommended Fix**: Maintain ship lookup map in GameState
```typescript
// Add to GameState
interface GameState {
  ships: Ship[];
  shipMap: Map<string | number, Ship>; // ID → Ship lookup
  // ... other fields
}

// Update on ship creation/removal
function addShip(state: GameState, ship: Ship) {
  state.ships.push(ship);
  state.shipMap.set(ship.id, ship);
}

// O(1) lookup in AI
const target = state.shipMap.get(ai.targetId) || null;
```

### 3. UI Array Operations in Hot Path [MEDIUM]

**Location**: `src/main.ts:347-349`
```typescript
// Creates temporary arrays every frame
const redCount = s.ships.filter((sh: any) => sh.team === 'red').length;
const blueCount = s.ships.filter((sh: any) => sh.team === 'blue').length;
```

**Impact**: Memory allocation + GC pressure every frame
**Recommended Fix**: Cache counts in GameState, update incrementally
```typescript
interface GameState {
  teamCounts: { red: number; blue: number };
}

// Update counts when ships are added/removed/change teams
function updateTeamCount(state: GameState, oldTeam?: string, newTeam?: string) {
  if (oldTeam) state.teamCounts[oldTeam]--;
  if (newTeam) state.teamCounts[newTeam]++;
}
```

## Scaling Behavior Issues

### 4. Worker Callback Array Copying [MEDIUM]

**Location**: `src/gamemanager.ts:432`
```typescript
// Unnecessary array copy
for (const cb of workerReadyCbs.slice()) {
  try { cb(); } catch (e) {}
}
```

**Fix**: Direct iteration prevents allocation
```typescript
// Iterate directly without copying
for (let i = 0; i < workerReadyCbs.length; i++) {
  try { workerReadyCbs[i](); } catch (e) {}
}
```

### 5. Render State Object Creation [MEDIUM]

**Location**: `src/gamemanager.ts:497-504`
```typescript
// Creates new object every frame
renderer.renderState({
  ships: state.ships,
  bullets: state.bullets,
  flashes,
  shieldFlashes,
  healthFlashes,
  t: state.t,
});
```

**Fix**: Reuse render state object
```typescript
// Create once, reuse
const renderState = {
  ships: null,
  bullets: null,
  flashes: null,
  shieldFlashes: null,
  healthFlashes: null,
  t: 0,
};

// Update properties only
renderState.ships = state.ships;
renderState.bullets = state.bullets;
renderState.t = state.t;
renderer.renderState(renderState);
```

## Memory Leak Risks

### 6. Timer Management [LOW-MEDIUM]

**Location**: `src/main.ts:251, 290`
- setTimeout IDs stored in Set but error paths may not clean up
- **Fix**: Wrap all timer operations in try-catch, ensure cleanup

### 7. GPU Resource Management [LOW-MEDIUM]

**Locations**: `src/webglrenderer.ts`, `src/canvasrenderer.ts`
- WebGL textures/buffers may not be released on context loss
- **Fix**: Implement proper cleanup methods in renderer classes

## Implementation Priority

### Phase 1 (Immediate - High Impact)
1. **Spatial partitioning for collision detection** - Biggest performance gain
2. **Ship lookup maps** - Eliminates AI performance cliff
3. **UI team count caching** - Reduces GC pressure

### Phase 2 (Next - Medium Impact)
4. **Worker callback optimization** - Minor allocation reduction
5. **Render state reuse** - Reduces object creation
6. **Timer cleanup hardening** - Prevents slow leaks

### Phase 3 (Later - Low Risk)
7. **GPU resource cleanup** - Insurance against edge cases

## Recommended Benchmarks

Add performance regression tests for:
- Collision detection with varying entity counts (10, 50, 100, 200 ships)
- AI decision time with large fleets
- Memory usage over extended play sessions (30+ minutes)
- Frame time consistency under load

## Measurement Strategy

Before implementing fixes:
1. Create baseline performance measurements
2. Add console.time/timeEnd around hot paths
3. Use Chrome DevTools Performance tab for memory profiling
4. Implement automated performance test suite

## Architecture Notes

The codebase shows excellent performance discipline in:
- ✅ Object pooling (bullets, particles, effects)
- ✅ Swap-pop optimizations for array removal
- ✅ Event system without array copying
- ✅ Fixed duplicate simulation calls
- ✅ Proper worker lifecycle management

These optimizations create a solid foundation. The recommended fixes address the remaining algorithmic complexity issues.