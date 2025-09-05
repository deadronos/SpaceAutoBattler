# Refactoring Plan for Spatial Search and AI Logic

## 1. Executive Summary

This document outlines a plan to refactor the spatial search and AI targeting logic in the codebase. The current implementation has several areas of duplicate and inefficient code, which makes it difficult to maintain, debug, and optimize. The proposed refactoring will centralize the spatial search logic, streamline the AI decision-making process, and improve the overall performance and maintainability of the codebase.

## 2. Identified Issues

### 2.1. Duplicate Spatial Search Logic

There are multiple implementations of spatial search logic scattered throughout the codebase. This leads to code duplication and makes it difficult to reason about the performance and correctness of the spatial queries.

**Example 1: Linear search in `pickBestTurretTarget`**

The `pickBestTurretTarget` function in `src/core/ai/turretTargeting.ts` performs a linear scan of all ships in the game to find the best target. This is inefficient and does not take advantage of the spatial grid.

```typescript
// src/core/ai/turretTargeting.ts
export function pickBestTurretTarget(state: GameState, ship: Ship, turret: TurretState, cfg: BehaviorConfig['turretConfig']): number | null {
  let bestId: number | null = null;
  let bestScore = -Infinity;
  for (const c of state.ships) { // Linear scan of all ships
    // ... scoring logic ...
  }
  return bestId;
}
```

**Example 2: Redundant spatial queries in `AIController`**

The `AIController` in `src/core/ai/controller.ts` performs several spatial queries in the `updateShipAI` function. These queries are often redundant and could be consolidated. For example, the controller finds the nearest enemy, and then later calculates separation forces, which also involves finding nearby ships.

### 2.2. Inefficient Spatial Grid Usage

The `SpatialGrid` is not being used to its full potential. The `ensureSpatialGridPopulated` function in `src/core/searchUtils.ts` rebuilds the entire grid from scratch on every call. This is inefficient and can be a major performance bottleneck.

```typescript
// src/core/searchUtils.ts
function ensureSpatialGridPopulated(state: GameState) {
  if (!state.spatialGrid) return;
  // Rebuild the spatial grid from current ships to provide a consistent
  // snapshot for queries when called outside the main update pass.
  state.spatialGrid.syncWithGameState(state); // Rebuilds the entire grid
}
```

### 2.3. Convoluted Targeting Logic

The AI targeting logic is spread across multiple files and functions, making it difficult to understand and modify. The `AIController` has a complex set of rules for target selection, which could be simplified and made more efficient.

## 3. Proposed Refactoring

### 3.1. Centralize Spatial Search Logic

All spatial search logic should be centralized in the `SpatialGrid` class. This will eliminate code duplication and provide a single, consistent interface for all spatial queries.

**Step 1: Refactor `pickBestTurretTarget`**

Modify `pickBestTurretTarget` to use `state.spatialGrid.queryRadius` to get a list of candidate targets within the turret's range. This will eliminate the inefficient linear scan of all ships.

**Step 2: Consolidate spatial queries in `AIController`**

Refactor the `AIController` to perform a single spatial query at the beginning of each update cycle to find all nearby ships. The results of this query can then be used for all subsequent calculations, such as finding the nearest enemy and calculating separation forces.

### 3.2. Optimize Spatial Grid Usage

Refactor the `SpatialGrid` to support incremental updates. Instead of rebuilding the entire grid from scratch, the `syncWithGameState` function should be modified to only update the cells that have changed since the last update.

### 3.3. Streamline AI Targeting Logic

Refactor the AI targeting logic to be more modular and data-driven. The `AIController` should be simplified to a set of high-level rules that delegate the details of target selection to a dedicated targeting module. This will make the targeting logic easier to understand, modify, and test.

## 4. Benefits of Refactoring

*   **Improved Performance:** Centralizing and optimizing the spatial search logic will significantly improve the performance of the AI, especially in scenarios with a large number of ships.
*   **Improved Maintainability:** A more modular and data-driven design will make the AI logic easier to understand, modify, and debug.
*   **Improved Testability:** A clear separation of concerns will make it easier to write unit tests for the individual components of the AI system.
*   **Foundation for Future Optimizations:** A clean and well-structured AI architecture will make it easier to implement more advanced features in the future, such as squad-based tactics and coordinated attacks. It also lays the groundwork for moving the spatial search to a web worker for further performance gains.
