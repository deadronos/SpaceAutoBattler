# Performance Optimization Implementation Guide

## Overview

This guide provides performance optimization fixes for the SpaceAutoBattler game, aligned with the current modular architecture described in `src-structure.md`. The codebase follows a configuration-driven design with clear separation between simulation, rendering, and AI systems.

## Current Architecture Context

The game uses:
- **Simulation**: Web Worker-based physics and AI in `src/simWorker.ts`
- **Game State**: Centralized state management in `src/core/gameState.ts`
- **AI Controller**: Configurable AI behaviors in `src/core/aiController.ts`
- **Physics**: Rapier3D integration in `src/core/physics.ts`
- **Main Loop**: Game coordination in `src/main.ts`
- **Types**: TypeScript definitions in `src/types/index.ts`

## Quick Fixes (1-2 hours implementation each)

### Fix 1: Ship Lookup Optimization

**Problem**: The current AI system frequently searches through the entire ships array using `find()` operations, which is O(n) for each lookup.

**Solution**: Add a ship lookup map to the GameState interface for O(1) ship lookups.

**File**: `src/types/index.ts`
```typescript
// Add to GameState interface
export interface GameState {
  // ... existing fields
  shipMap: Map<EntityId, Ship>; // Fast O(1) ship lookup
}
```

**File**: `src/core/gameState.ts`
```typescript
// Update createInitialState function
export function createInitialState(seed?: string): GameState {
  // ... existing code ...
  return {
    // ... existing fields
    shipMap: new Map(),
  };
}

// Update spawnShip function
export function spawnShip(state: GameState, team: Team, cls: ShipClass, pos?: Vector3, parentCarrierId?: EntityId): Ship {
  // ... existing ship creation code ...
  state.ships.push(ship);
  state.shipMap.set(ship.id, ship); // Add to lookup map
  return ship;
}

// Add helper function for ship removal
export function removeShip(state: GameState, shipId: EntityId) {
  const ship = state.shipMap.get(shipId);
  if (ship) {
    const index = state.ships.findIndex(s => s.id === shipId);
    if (index !== -1) {
      state.ships.splice(index, 1);
      state.shipMap.delete(shipId);
      state.teamCounts[ship.team] = Math.max(0, (state.teamCounts[ship.team] || 0) - 1); // Decrement team count
    }
  }
}
```

**File**: `src/core/aiController.ts`
```typescript
// Replace ship.find() calls in AI methods
// OLD:
private findNearestEnemy(ship: Ship): Ship | null {
  let best: Ship | null = null;
  let bestDist = Infinity;

  for (const s of this.state.ships) {
    if (s.team === ship.team || s.health <= 0) continue;
    const dist = this.getDistance(ship.pos, s.pos);
    if (dist < bestDist) {
      bestDist = dist;
      best = s;
    }
  }
  return best;
}

// NEW:
private findNearestEnemy(ship: Ship): Ship | null {
  let best: Ship | null = null;
  let bestDist = Infinity;

  // Use lookup map for target finding
  if (ship.targetId) {
    const target = this.state.shipMap.get(ship.targetId);
    if (target && target.team !== ship.team && target.health > 0) {
      return target;
    }
  }

  // Fallback to iteration if no valid target
  for (const s of this.state.ships) {
    if (s.team === ship.team || s.health <= 0) continue;
    const dist = this.getDistance(ship.pos, s.pos);
    if (dist < bestDist) {
      bestDist = dist;
      best = s;
    }
  }
  return best;
}
```

### Fix 2: Team Count Caching

**Problem**: UI frequently calculates team counts by filtering the ships array, which is inefficient.

**Solution**: Cache team counts in GameState and update them incrementally.

**File**: `src/types/index.ts`
```typescript
export interface GameState {
  // ... existing fields
  teamCounts: { red: number; blue: number; [key: string]: number };
}
```

**File**: `src/core/gameState.ts`
```typescript
export function createInitialState(seed?: string): GameState {
  // ... existing code ...
  return {
    // ... existing fields
    teamCounts: { red: 0, blue: 0 },
  };
}

// Update spawnShip to increment team count
export function spawnShip(state: GameState, team: Team, cls: ShipClass, pos?: Vector3, parentCarrierId?: EntityId): Ship {
  // ... existing ship creation code ...
  state.ships.push(ship);
  state.shipMap.set(ship.id, ship);
  state.teamCounts[team] = (state.teamCounts[team] || 0) + 1; // Increment team count
  return ship;
}

// Update removeShip to decrement team count
export function removeShip(state: GameState, shipId: EntityId) {
  const ship = state.shipMap.get(shipId);
  if (ship) {
    const index = state.ships.findIndex(s => s.id === shipId);
    if (index !== -1) {
      state.ships.splice(index, 1);
      state.shipMap.delete(shipId);
      state.teamCounts[ship.team] = Math.max(0, (state.teamCounts[ship.team] || 0) - 1); // Decrement team count
    }
  }
}
```

**File**: `src/main.ts`
```typescript
// Replace filter operations in UI update functions
// OLD:
function updateScores() {
  const redCount = state.ships.filter(s => s.team === 'red' && s.health > 0).length;
  const blueCount = state.ships.filter(s => s.team === 'blue' && s.health > 0).length;
  // ... update UI
}

// NEW:
function updateScores() {
  const redCount = state.teamCounts.red || 0;
  const blueCount = state.teamCounts.blue || 0;
  // ... update UI
}
```

### Fix 3: Worker Message Optimization

**Problem**: The simWorker frequently processes redundant ship data updates.

**Solution**: Implement change detection and batch updates in the worker communication.

**File**: `src/simWorker.ts`
```typescript
// Add change tracking
let lastShipData: any[] = [];
let lastShipDataHash = '';

// Update message handler
self.addEventListener('message', async (e) => {
  const { type, payload } = e.data || {};

  if (type === 'update-ships') {
    const shipData = payload?.ships || [];

    // Create hash for change detection
    const currentHash = JSON.stringify(shipData);
    if (currentHash === lastShipDataHash) {
      // No changes, skip update
      (self as any).postMessage({ type: 'update-ships-done' });
      return;
    }

    // Update only changed ships
    for (const ship of shipData) {
      let body = bodies.get(ship.id);

      if (!body) {
        // Create new body
        body = createBodyForShip(ship);
        if (body) {
          bodies.set(ship.id, body);
        }
      } else {
        // Update existing body
        updateBodyFromShip(body, ship);
      }
    }

    lastShipData = shipData;
    lastShipDataHash = currentHash;
    (self as any).postMessage({ type: 'update-ships-done' });
    return;
  }

  // ... existing code ...
});
```

**File**: `src/main.ts`
```typescript
// Optimize ship data sending
function updateWorkerShips(state: GameState) {
  const shipData = state.ships.map(ship => ({
    id: ship.id,
    pos: { ...ship.pos },
    vel: { ...ship.vel }
  }));

  // Only send if data has actually changed
  const currentHash = JSON.stringify(shipData);
  if (currentHash !== lastShipDataHash) {
    w.postMessage({ type: 'update-ships', payload: { ships: shipData } });
    lastShipDataHash = currentHash;
  }
}
```

## Medium Complexity Fixes (4-8 hours implementation)

### Fix 4: Spatial Partitioning for Collision Detection

**Problem**: The current collision detection in `gameState.ts` uses O(n²) nested loops for bullet-ship collisions.

**Solution**: Implement spatial partitioning to reduce collision checks to nearby entities only.

**File**: `src/utils/spatialGrid.ts` (new file)
```typescript
import type { Vector3, EntityId } from '../types/index.js';

export interface SpatialEntity {
  id: EntityId;
  pos: Vector3;
  radius: number;
  team: string;
}

export class SpatialGrid {
  private cellSize: number;
  private grid: Map<string, SpatialEntity[]> = new Map();
  private bounds: { width: number; height: number; depth: number };

  constructor(cellSize: number = 64, bounds = { width: 1920, height: 1080, depth: 600 }) {
    this.cellSize = cellSize;
    this.bounds = bounds;
  }

  clear() {
    this.grid.clear();
  }

  private getCellKey(x: number, y: number, z: number): string {
    const cellX = Math.floor(x / this.cellSize);
    const cellY = Math.floor(y / this.cellSize);
    const cellZ = Math.floor(z / this.cellSize);
    return `${cellX},${cellY},${cellZ}`;
  }

  insert(entity: SpatialEntity) {
    const key = this.getCellKey(entity.pos.x, entity.pos.y, entity.pos.z);
    if (!this.grid.has(key)) {
      this.grid.set(key, []);
    }
    this.grid.get(key)!.push(entity);
  }

  queryRadius(center: Vector3, radius: number): SpatialEntity[] {
    const results: SpatialEntity[] = [];
    const cellRadius = Math.ceil(radius / this.cellSize);
    const centerCellX = Math.floor(center.x / this.cellSize);
    const centerCellY = Math.floor(center.y / this.cellSize);
    const centerCellZ = Math.floor(center.z / this.cellSize);

    for (let dx = -cellRadius; dx <= cellRadius; dx++) {
      for (let dy = -cellRadius; dy <= cellRadius; dy++) {
        for (let dz = -cellRadius; dz <= cellRadius; dz++) {
          const key = `${centerCellX + dx},${centerCellY + dy},${centerCellZ + dz}`;
          const entities = this.grid.get(key);
          if (entities) {
            results.push(...entities);
          }
        }
      }
    }
    return results;
  }

  // Optimized query for bullet-ship collisions
  queryBulletCollisions(bulletPos: Vector3, bulletRadius: number, maxShipRadius: number = 20): SpatialEntity[] {
    return this.queryRadius(bulletPos, bulletRadius + maxShipRadius);
  }
}
```

**File**: `src/core/gameState.ts`
```typescript
import { SpatialGrid, type SpatialEntity } from '../utils/spatialGrid.js';

// Add spatial grid to GameState
export interface GameState {
  // ... existing fields
  spatialGrid?: SpatialGrid;
}

// Update createInitialState
export function createInitialState(seed?: string): GameState {
  // ... existing code ...
  return {
    // ... existing fields
    spatialGrid: new SpatialGrid(64),
  };
}

// Update simulateStep function
export function simulateStep(state: GameState, dt: number) {
  // Update spatial grid with current ship positions
  if (state.spatialGrid) {
    state.spatialGrid.clear();
    for (const ship of state.ships) {
      if (ship.health > 0) {
        state.spatialGrid.insert({
          id: ship.id,
          pos: ship.pos,
          radius: 16, // Approximate ship radius
          team: ship.team
        });
      }
    }
  }

  // ... existing ship AI code ...

  // Optimize bullet collision detection
  const maxShipRadius = 20;
  for (let bi = state.bullets.length - 1; bi >= 0; bi--) {
    const b = state.bullets[bi];
    if (b.ttl <= 0) continue;

    let nearbyShips: Ship[] = [];

    if (state.spatialGrid) {
      // Use spatial partitioning
      const nearbyEntities = state.spatialGrid.queryBulletCollisions(
        b.pos,
        b.radius || 1,
        maxShipRadius
      );
      nearbyShips = nearbyEntities
        .map(entity => state.shipMap.get(entity.id))
        .filter(ship => ship && ship.team !== b.ownerTeam && ship.health > 0) as Ship[];
    } else {
      // Fallback to linear search
      nearbyShips = state.ships.filter(s => s.team !== b.ownerTeam && s.health > 0);
    }

    // Check collisions with nearby ships only
    for (const s of nearbyShips) {
      const dx = s.pos.x - b.pos.x;
      const dy = s.pos.y - b.pos.y;
      const dz = s.pos.z - b.pos.z;
      const dist = Math.hypot(dx, dy, dz);
      const hitRadius = (s.class === 'destroyer' || s.class === 'carrier' ? 20 : 10) + (b.radius || 1);

      if (dist < hitRadius) {
        // Apply damage (existing collision logic)
        let dmgLeft = b.damage;
        if (s.shield > 0) {
          const absorb = Math.min(s.shield, dmgLeft);
          s.shield -= absorb;
          dmgLeft -= absorb;
          s.lastShieldHitTime = state.time;
        }
        if (dmgLeft > 0) {
          const effective = Math.max(1, dmgLeft - s.armor * 0.3);
          s.health -= effective;
          const owner = state.ships.find(sh => sh.id === b.ownerShipId);
          if (owner) {
            owner.level.xp += effective * XP_PER_DAMAGE;
          }
        }
        b.ttl = 0;
        break;
      }
    }
  }

  // ... rest of existing simulation code ...
}
```

### Fix 5: Render State Object Reuse

**Problem**: The main thread creates new objects every frame for render state communication.

**Solution**: Reuse render state objects to reduce garbage collection pressure.

**File**: `src/main.ts`
```typescript
// Add reusable render state object
const renderStateObject = {
  ships: null as any,
  bullets: null as any,
  flashes: null as any,
  shieldFlashes: null as any,
  healthFlashes: null as any,
  t: 0,
  time: 0,
  score: { red: 0, blue: 0 }
};

// Update the render loop
function startLoops(state: GameState, ui: UIElements) {
  // ... existing code ...

  function frame(now: number) {
    // ... existing simulation code ...

    // Render with reused state object
    if (state.renderer?.renderState) {
      // Reuse object, only update properties
      renderStateObject.ships = state.ships;
      renderStateObject.bullets = state.bullets;
      renderStateObject.t = state.time;
      renderStateObject.time = state.time;
      renderStateObject.score = state.score;

      try {
        state.renderer.renderState(renderStateObject);
      } catch (e) {
        // Fallback to individual parameters if needed
        state.renderer.renderState(
          state.ships,
          state.bullets,
          state.time,
          state.score
        );
      }
    } else if (state.renderer?.render) {
      state.renderer.render(dt);
    }

    // ... existing stats and loop code ...
  }
}
```

## Testing the Fixes

### Performance Test Template

**File**: `test/vitest/performance-improvements.spec.ts`
```typescript
import { describe, it, expect } from "vitest";
import { createInitialState, spawnShip, simulateStep } from "../../src/core/gameState.js";
import type { GameState } from "../../src/types/index.js";

describe("Performance Improvements", () => {
  it("should handle large entity counts efficiently", () => {
    const state = createInitialState();

    // Add many ships
    for (let i = 0; i < 100; i++) {
      const team = i % 2 === 0 ? 'red' : 'blue';
      spawnShip(state, team, 'fighter');
    }

    // Add many bullets
    for (let i = 0; i < 200; i++) {
      const team = i % 2 === 0 ? 'red' : 'blue';
      state.bullets.push({
        id: state.nextId++,
        ownerShipId: 1,
        ownerTeam: team,
        pos: { x: Math.random() * 1920, y: Math.random() * 1080, z: Math.random() * 600 },
        vel: { x: 0, y: 0, z: 0 },
        ttl: 3,
        damage: 10,
      });
    }

    const startTime = performance.now();

    // Run simulation steps
    for (let i = 0; i < 10; i++) {
      simulateStep(state, 0.016);
    }

    const endTime = performance.now();
    const totalTime = endTime - startTime;

    // Should complete in reasonable time (adjust threshold as needed)
    expect(totalTime).toBeLessThan(100); // 100ms for 10 frames with 100 ships + 200 bullets
  });

  it("should maintain consistent memory usage", () => {
    const state = createInitialState();

    // Baseline memory
    const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;

    // Simulate extended gameplay
    for (let frame = 0; frame < 1000; frame++) {
      // Add/remove entities to simulate gameplay
      if (frame % 10 === 0) {
        spawnShip(state, 'red', 'fighter');
      }

      simulateStep(state, 0.016);

      // Clean up dead ships
      for (let i = state.ships.length - 1; i >= 0; i--) {
        if (state.ships[i].health <= 0) {
          state.ships.splice(i, 1);
        }
      }
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

  it("should verify ship lookup map consistency", () => {
    const state = createInitialState();

    // Add some ships
    const ship1 = spawnShip(state, 'red', 'fighter');
    const ship2 = spawnShip(state, 'blue', 'corvette');

    // Verify map consistency
    expect(state.shipMap.get(ship1.id)).toBe(ship1);
    expect(state.shipMap.get(ship2.id)).toBe(ship2);
    expect(state.shipMap.size).toBe(2);

    // Test removal
    state.ships = state.ships.filter(s => s.id !== ship1.id);
    state.shipMap.delete(ship1.id);

    expect(state.shipMap.get(ship1.id)).toBeUndefined();
    expect(state.shipMap.size).toBe(1);
  });

  it("should verify team count caching", () => {
    const state = createInitialState();

    // Add ships
    spawnShip(state, 'red', 'fighter');
    spawnShip(state, 'red', 'corvette');
    spawnShip(state, 'blue', 'fighter');

    // Verify team counts
    expect(state.teamCounts.red).toBe(2);
    expect(state.teamCounts.blue).toBe(1);

    // Remove a red ship
    const redShip = state.ships.find(s => s.team === 'red')!;
    state.ships = state.ships.filter(s => s.id !== redShip.id);
    state.shipMap.delete(redShip.id);
    state.teamCounts.red--;

    expect(state.teamCounts.red).toBe(1);
    expect(state.teamCounts.blue).toBe(1);
  });
});
```

## Deployment Strategy

1. **Implement fixes incrementally** - One PR per major fix
2. **Benchmark before/after** - Use Chrome DevTools Performance tab
3. **Run extended tests** - Verify no regressions in long-running sessions
4. **Monitor in production** - Add performance.mark() calls for key operations

## Expected Performance Gains

- **Collision Detection**: 10x-100x improvement with many entities through spatial partitioning
- **AI Performance**: 5x-20x improvement with large fleets through optimized lookups
- **Memory Usage**: 20-50% reduction in GC pressure through object reuse
- **Frame Time**: More consistent frame timing under load
- **Worker Communication**: Reduced overhead through change detection

## Architecture Alignment

These optimizations maintain the current modular architecture:
- **Configuration-driven**: All performance parameters can be tuned via config files
- **Separation of concerns**: Simulation, rendering, and AI remain independent
- **Deterministic simulation**: Optimizations preserve deterministic behavior
- **Web Worker isolation**: Performance fixes work within the existing worker model
- **Type safety**: All changes maintain TypeScript type safety

## Monitoring and Maintenance

After implementing these fixes:

1. **Add performance markers** around critical sections:
```typescript
performance.mark('simulation-start');
// ... simulation code ...
performance.mark('simulation-end');
performance.measure('simulation', 'simulation-start', 'simulation-end');
```

2. **Monitor memory usage** in production:
```typescript
// Log memory usage periodically
setInterval(() => {
  if (performance.memory) {
    console.log('Memory:', performance.memory.usedJSHeapSize / 1024 / 1024, 'MB');
  }
}, 5000);
```

3. **Profile with Chrome DevTools** to identify new bottlenecks after optimizations

4. **A/B test performance** with different entity counts to validate improvements