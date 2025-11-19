# SpaceAutoBattler Codebase Overview

## Architecture Summary

The project is a **3D Space Combat Simulator** built using a "Headless Simulation" pattern, even though it currently runs entirely in the browser's main thread.

- **Rendering**: React Three Fiber (R3F) / Three.js
- **Physics**: Rapier3D (via `@dimforge/rapier3d-compat`)
- **State Management / ECS**: Miniplex
- **Language**: TypeScript

### Key Directories

- **`src/game`**: Contains all simulation logic. This is the "core" that is candidate for porting.
- **`src/components`**: React components for rendering the game state (Views).
- **`src/renderer`**: Three.js specific rendering logic (shaders, effects).
- **`src/ui`**: 2D UI overlays (HUD, controls).

## The Game Loop (`src/game/context.tsx` & `systems.ts`)

The application uses a decoupled game loop pattern:

1.  **State Initialization**: `createGameState()` in `src/game/createGameState.ts` sets up the Rapier world, Miniplex ECS world, and initial state.
2.  **The Loop**: The `GameProvider` component (`src/game/context.tsx`) sets up the loop. It exposes a `tick` function that advances the simulation.
3.  **Update Cycle**: `updateGame(state, delta)` in `src/game/systems.ts` is the heart of the simulation. It orchestrates the execution of all subsystems in a specific order:
    - **Decision**: AI logic (`updateDecisionSystem`)
    - **Preparation**: Ship control (`prepareShips`)
    - **Combat**: Carrier launches, Turret updates (`updateTurrets`)
    - **Physics**:
        - `flushDeferredMutations`: Applies changes buffered from the previous frame.
        - `physicsWorld.step()`: Advances Rapier simulation.
        - `flushPostPhysicsMutations`: Applies changes that depend on the new physics state.
    - **Resolution**: Syncs physics transforms back to ECS entities (`syncTransforms`), resolves damage/projectiles.

## Entity Component System (ECS)

The project uses **Miniplex** for ECS.

- **Entities**: Plain JS objects typed as `GameEntity`.
- **Queries**: Defined in `GameState['queries']` (e.g., `ships`, `projectiles`).
- **Data Flow**: Systems iterate over queries, modify component data, or queue mutations.

## Physics Integration

Physics is handled by **Rapier3D**.

- **Determinism**: The simulation attempts to be deterministic by using fixed time steps (implied structure, though currently driven by `requestAnimationFrame` delta in `updateGame`, it tracks accumulation).
- **Safety**: Direct mutations to Rapier bodies during a step can cause crashes. The project uses a **Deferred Mutation System** (`simulationQueue.ts`, `wrappers.ts`) to queue operations like `setLinvel` or `setTranslation` to be applied safely before/after the physics step.

## AI & Behavior

- **Doctrine**: AI behavior is data-driven (`aiDoctrine.ts`).
- **Intents**: The decision system evaluates "Intents" (Attack, Kite, Escort) and selects the highest-scoring one.
- **Blackboard**: A shared data structure (`blackboard.ts`) is used for spatial reasoning and team-level coordination.

