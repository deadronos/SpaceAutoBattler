# core-physics.md

## Purpose

This file documents the current React Three Fiber + Rapier physics integration in the SpaceAutoBattler project.

## Location

src/game/state.ts, src/game/systems.ts

## Summary

The physics system now runs directly on the main thread integrated with React Three Fiber and Miniplex ECS. `createGameState()` initializes a Rapier physics world alongside the ECS world, and `updateGame()` handles the physics step and entity synchronization.

## Key Responsibilities

- Initialize Rapier physics world in `createGameState()` 
- Create Rapier rigid bodies and colliders for ECS entities (ships/projectiles)
- Run physics simulation step each frame via `updateGame()`
- Synchronize physics transforms back to ECS entity components
- Handle collision detection and response for combat
- Manage entity lifecycle (creation/destruction of physics bodies)

## Integration Points

- Used directly in main thread via React Three Fiber useFrame hook
- Reads and writes ECS entities via Miniplex archetype queries  
- Physics world state stored in canonical `GameState` object
- No worker communication - direct API calls on main thread

## Performance & Safety Notes

- Physics runs on main thread - no cross-thread communication overhead
- Direct integration with ECS provides immediate data consistency
- Rapier WASM module loaded once during game state initialization
- Entity cleanup properly disposes both ECS entities and physics bodies

## Where to look

- `src/game/state.ts` for physics world initialization
- `src/game/systems.ts` for physics step integration and entity sync
- `src/components/Battlefield.tsx` for React Three Fiber game loop

## References

- src/game/state.ts
- src/game/systems.ts  
- src/components/Battlefield.tsx
