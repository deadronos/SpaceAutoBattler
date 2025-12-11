# game/ - Core Game Logic and Systems

The heart of the game engine. Contains game state management, AI systems, physics integration, combat mechanics, and progression systems.

## Core Architecture Files

| File              | Purpose                                                                                            |
| ----------------- | -------------------------------------------------------------------------------------------------- |
| **context.tsx**   | React Context provider for GameState; initializes and manages global game state throughout the app |
| **state.ts**      | Core GameState type definitions and initial state factory                                          |
| **config.ts**     | Game configuration parameters and constants                                                        |
| **subsystems.ts** | Coordinates all game subsystems and their update order                                             |
| **systems.ts**    | Main system orchestration; determines which systems run each frame                                 |

## Game Data & Profiles

| File                  | Purpose                                                                  |
| --------------------- | ------------------------------------------------------------------------ |
| **aiProfiles.ts**     | AI behavior profiles defining different difficulty levels and strategies |
| **aiTraits.ts**       | Individual AI ship traits and behavioral characteristics                 |
| **aiDoctrine.ts**     | High-level AI tactical doctrines and strategies                          |
| **aiState.ts**        | Runtime state for individual AI ships                                    |
| **ships.ts**          | Ship definitions and factory functions                                   |
| **turretRegistry.ts** | Registry of turret types and configurations                              |

## Game Logic

| File                   | Purpose                                           |
| ---------------------- | ------------------------------------------------- |
| **progression.ts**     | Ship progression, leveling, and experience system |
| **metrics.ts**         | Tracking game metrics and statistics              |
| **uiStore.ts**         | UI state management (independent of game state)   |
| **safeSnapshot.ts**    | Utilities for safely serializing game state       |
| **validation.ts**      | Game state validation and integrity checks        |
| **simulationQueue.ts** | Queues and schedules AI simulation work           |

## Subdirectories

### [systems/](./systems/) - Game Systems

Core gameplay systems that execute each frame (combat, physics, AI, projectiles, etc.).

### [physics/](./physics/) - Physics Integration

Wrappers and utilities for Rapier3D physics engine integration with game state.

### [utils/](./utils/) - Utility Functions

Helper functions for game logic (AI calculations, physics utilities).

### [progression/](./progression/) - Progression System

Ship progression, leveling, XP, and talent systems.

### [combat/](./combat/) - Combat Mechanics

Damage calculation and combat-related utilities.

## State Flow

```
GameProvider (top-level)
  ↓ (useState)
GameState
  ├─ Ships (entities)
  ├─ Projectiles (entities)
  ├─ Combat events
  └─ Simulation queue

Each frame:
  ├─ systems.ts → determines which systems run
  ├─ physics/index.ts → steps physics
  ├─ systems/combat.ts → resolves damage
  ├─ systems/projectiles.ts → updates projectiles
  ├─ systems/motion.ts → applies movement
  ├─ systems/turrets.ts → fires weapons
  └─ [other systems]
```

## Key Principles

- **Centralized State**: All game state in `GameState` type via React Context
- **Deterministic**: Uses seeded RNG for reproducible gameplay
- **ECS Integration**: Entities managed by Miniplex ECS
- **Physics-Coupled**: Updates are tied to Rapier3D simulation
- **AI-Driven**: Autonomous ship control via AI decision systems
