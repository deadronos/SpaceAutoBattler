# Performance Optimization Implementation Guide

## Quick Fixes (1-2 hours implementation each)

### Fix 1: Ship Lookup Maps

**File**: `src/types/index.ts`
```typescript
// Add to GameState interface
export interface GameState {
  // ... existing fields
  shipMap: Map<string | number, Ship>; // Fast O(1) ship lookup
}
```

**File**: `src/entities.ts`
```typescript
// Update makeInitialState
export function makeInitialState(): GameState {
  return {
    // ... existing fields
    shipMap: new Map(),
  };
}
```

**File**: `src/gamemanager.ts`
```typescript
// Update ship creation
function addShipToState(state: GameState, ship: Ship) {
  state.ships.push(ship);
  state.shipMap.set(ship.id, ship);
}

// Update ship removal
function removeShipFromState(state: GameState, shipId: string | number) {
  const index = state.ships.findIndex(s => s.id === shipId);
  if (index !== -1) {
    state.ships.splice(index, 1);
    state.shipMap.delete(shipId);
  }
}
```

**File**: `src/behavior.ts`
```typescript
// Replace ship.find() calls
// OLD:
turretTarget = (state.ships || []).find(
  (sh) => sh && sh.id === ship.__ai.targetId,
) || null;

// NEW:
turretTarget = state.shipMap.get(ship.__ai.targetId) || null;
```

### Fix 2: UI Team Count Caching

**File**: `src/types/index.ts`
```typescript
export interface GameState {
  // ... existing fields
  teamCounts: { red: number; blue: number; [key: string]: number };
}
```

**File**: `src/entities.ts`
```typescript
export function makeInitialState(): GameState {
  return {
    // ... existing fields
    teamCounts: { red: 0, blue: 0 },
  };
}
```

**File**: `src/gamemanager.ts`
```typescript
// Helper function
function updateTeamCount(state: GameState, ship: Ship, operation: 'add' | 'remove') {
  const team = ship.team || 'neutral';
  if (operation === 'add') {
    state.teamCounts[team] = (state.teamCounts[team] || 0) + 1;
  } else {
    state.teamCounts[team] = Math.max(0, (state.teamCounts[team] || 0) - 1);
  }
}

// Update ship addition
function addShipToState(state: GameState, ship: Ship) {
  state.ships.push(ship);
  state.shipMap.set(ship.id, ship);
  updateTeamCount(state, ship, 'add');
}
```

**File**: `src/main.ts`
```typescript
// Replace filter operations
// OLD:
const redCount = s.ships.filter((sh: any) => sh.team === 'red').length;
const blueCount = s.ships.filter((sh: any) => sh.team === 'blue').length;

// NEW:
const redCount = s.teamCounts.red || 0;
const blueCount = s.teamCounts.blue || 0;
```

### Fix 3: Worker Callback Optimization

**File**: `src/gamemanager.ts`
```typescript
// Replace array copying
// OLD:
for (const cb of workerReadyCbs.slice()) {
  try { cb(); } catch (e) {}
}

// NEW:
for (let i = 0; i < workerReadyCbs.length; i++) {
  try { workerReadyCbs[i](); } catch (e) {}
}
```

## Medium Complexity Fixes (4-8 hours implementation)

### Fix 4: Spatial Partitioning for Collision Detection

**File**: `src/spatial.ts` (new file)
```typescript
export interface Entity {
  x: number;
  y: number;
  radius: number;
  team?: string;
}

export class SpatialGrid {
  private cellSize: number;
  private grid: Map<string, Entity[]> = new Map();
  private bounds: { W: number; H: number };

  constructor(cellSize: number = 64, bounds = { W: 1920, H: 1080 }) {
    this.cellSize = cellSize;
    this.bounds = bounds;
  }

  clear() {
    this.grid.clear();
  }

  private getCellKey(x: number, y: number): string {
    const cellX = Math.floor(x / this.cellSize);
    const cellY = Math.floor(y / this.cellSize);
    return `${cellX},${cellY}`;
  }

  insert(entity: Entity) {
    const key = this.getCellKey(entity.x, entity.y);
    if (!this.grid.has(key)) {
      this.grid.set(key, []);
    }
    this.grid.get(key)!.push(entity);
  }

  queryRadius(x: number, y: number, radius: number): Entity[] {
    const results: Entity[] = [];
    const cellRadius = Math.ceil(radius / this.cellSize);
    const centerCellX = Math.floor(x / this.cellSize);
    const centerCellY = Math.floor(y / this.cellSize);

    for (let dx = -cellRadius; dx <= cellRadius; dx++) {
      for (let dy = -cellRadius; dy <= cellRadius; dy++) {
        const key = `${centerCellX + dx},${centerCellY + dy}`;
        const entities = this.grid.get(key);
        if (entities) {
          results.push(...entities);
        }
      }
    }
    return results;
  }
}
```

**File**: `src/simulate.ts`
```typescript
import { SpatialGrid } from './spatial';

// Add spatial grid to simulation
export function simulateStep(state: GameState, dtSeconds: number, bounds: Bounds) {
  // Create spatial grid for this frame
  const spatialGrid = new SpatialGrid(64, bounds);
  
  // Insert all ships into spatial grid
  for (const ship of state.ships) {
    spatialGrid.insert(ship);
  }

  // ... existing simulation code ...

  // REPLACE the nested bullet-ship loop:
  // OLD O(n²) approach:
  /*
  for (let bi = (state.bullets || []).length - 1; bi >= 0; bi--) {
    const b = state.bullets[bi];
    for (let si = (state.ships || []).length - 1; si >= 0; si--) {
      const s = state.ships[si];
      // ... collision check
    }
  }
  */

  // NEW O(n log n) approach with spatial partitioning:
  for (let bi = (state.bullets || []).length - 1; bi >= 0; bi--) {
    const b = state.bullets[bi];
    const bulletRadius = b.radius || 1;
    
    // Query only nearby ships
    const nearbyShips = spatialGrid.queryRadius(b.x, b.y, bulletRadius + 20); // +20 for max ship radius
    
    for (const s of nearbyShips) {
      if (s.team === b.team) continue;
      const r = (s.radius || 6) + bulletRadius;
      if (dist2(b, s) <= r * r) {
        // ... existing collision handling
      }
    }
  }
}
```

### Fix 5: Render State Reuse

**File**: `src/gamemanager.ts`
```typescript
export function createGameManager(options: GameManagerOptions = {}) {
  // ... existing code ...
  
  // Create reusable render state object
  const renderStateObject = {
    ships: null as any,
    bullets: null as any,
    flashes: null as any,
    shieldFlashes: null as any,
    healthFlashes: null as any,
    t: 0,
  };

  function step(dtSeconds: number) {
    // ... existing simulation code ...
    
    if (renderer && typeof renderer.renderState === "function") {
      try {
        // Reuse object, only update properties
        renderStateObject.ships = state.ships;
        renderStateObject.bullets = state.bullets;
        renderStateObject.flashes = flashes;
        renderStateObject.shieldFlashes = shieldFlashes;
        renderStateObject.healthFlashes = healthFlashes;
        renderStateObject.t = state.t;
        
        renderer.renderState(renderStateObject);
      } catch (e) {}
    }
  }
}
```

## Testing the Fixes

### Performance Test Template

**File**: `test/vitest/performance-improvements.spec.ts`
```typescript
import { describe, it, expect } from "vitest";
import { makeInitialState } from "../../src/entities";
import { simulateStep } from "../../src/simulate";

describe("Performance Improvements", () => {
  it("should handle large entity counts efficiently", () => {
    const state = makeInitialState();
    
    // Add many ships
    for (let i = 0; i < 100; i++) {
      state.ships.push({
        id: i,
        x: Math.random() * 1920,
        y: Math.random() * 1080,
        team: i % 2 === 0 ? 'red' : 'blue',
        radius: 12,
        hp: 100,
        maxHp: 100,
      });
    }
    
    // Add many bullets
    for (let i = 0; i < 200; i++) {
      state.bullets.push({
        x: Math.random() * 1920,
        y: Math.random() * 1080,
        team: i % 2 === 0 ? 'red' : 'blue',
        radius: 2,
        damage: 10,
      });
    }

    const startTime = performance.now();
    
    // Run simulation steps
    for (let i = 0; i < 10; i++) {
      simulateStep(state, 0.016, { W: 1920, H: 1080 });
    }
    
    const endTime = performance.now();
    const totalTime = endTime - startTime;
    
    // Should complete in reasonable time (adjust threshold as needed)
    expect(totalTime).toBeLessThan(100); // 100ms for 10 frames with 100 ships + 200 bullets
  });

  it("should maintain consistent memory usage", () => {
    const state = makeInitialState();
    
    // Baseline memory
    const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;
    
    // Simulate extended gameplay
    for (let frame = 0; frame < 1000; frame++) {
      // Add/remove entities to simulate gameplay
      if (frame % 10 === 0) {
        state.ships.push({
          id: frame,
          x: 100,
          y: 100,
          team: 'red',
          hp: 100,
          maxHp: 100,
        });
      }
      
      simulateStep(state, 0.016, { W: 1920, H: 1080 });
      
      // Clean up dead ships
      state.ships = state.ships.filter(s => s.hp > 0);
    }
    
    // Force garbage collection if available
    if ((global as any).gc) {
      (global as any).gc();
    }
    
    const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
    const memoryGrowth = finalMemory - initialMemory;
    
    // Memory growth should be bounded (adjust threshold as needed)
    expect(memoryGrowth).toBeLessThan(10_000_000); // 10MB max growth
  });
});
```

## Deployment Strategy

1. **Implement fixes incrementally** - One PR per major fix
2. **Benchmark before/after** - Use Chrome DevTools Performance tab
3. **Run extended tests** - Verify no regressions in long-running sessions
4. **Monitor in production** - Add performance.mark() calls for key operations

## Expected Performance Gains

- **Collision Detection**: 10x-100x improvement with many entities
- **AI Performance**: 5x-20x improvement with large fleets  
- **Memory Usage**: 20-50% reduction in GC pressure
- **Frame Time**: More consistent frame timing under load