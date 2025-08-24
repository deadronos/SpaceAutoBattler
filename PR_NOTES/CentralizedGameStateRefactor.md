Feature Proposal: Centralized GameState Refactor
===============================================

Summary
-------
Refactor the main lifecycle to instantiate a single `GameState` object at startup, from which all simulation and rendering state is derived and mutated. This will improve maintainability, testability, determinism, and extensibility.

Why This Is a Good Idea
-----------------------
- **Centralized State Management:**  
  All simulation and rendering logic can reference a single source of truth, reducing bugs from scattered state.
- **Determinism & Replay:**  
  Easier to serialize/deserialize the entire game state for deterministic simulation, debugging, or replay.
- **Extensibility:**  
  Adding new features (e.g., powerups, teams, events) becomes simpler—just extend the `GameState` type.
- **Testing:**  
  Unit tests can easily set up, clone, and inspect game state.
- **Isolation:**  
  Each simulation step can take a `GameState` and produce a new one (or mutate in place), making rollback and branching possible.

How to Approach the Refactor
----------------------------
1. **Define a Canonical `GameState` Type**  
   - In `src/types/index.ts`, create a `GameState` interface that includes all top-level state: ships, bullets, events, etc.

2. **Update Main Lifecycle**  
   - In `src/main.ts`, instantiate a new `GameState` at startup.
   - Pass this object to all subsystems (simulation, renderer, UI).

3. **Refactor Subsystems**  
   - Update simulation (`simulateStep`), renderer, and UI logic to accept and mutate the `GameState` object.
   - Remove any scattered state variables; everything should be a property of `GameState`.

4. **Testing & Validation**  
   - Update tests to use the new `GameState` structure.
   - Ensure serialization/deserialization works for replay/determinism.

5. **Documentation**  
   - Update docs to reflect the new state management approach.

Example `GameState` Type
------------------------
```typescript
export interface GameState {
  ships: Ship[];
  bullets: Bullet[];
  explosions: Explosion[];
  shieldHits: ShieldHit[];
  healthHits: HealthHit[];
  // Add more as needed (e.g., teams, powerups, round info)
}