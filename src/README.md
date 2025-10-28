# src/ - SpaceAutoBattler Source Code

This directory contains the complete TypeScript/React source code for SpaceAutoBattler, a 3D space combat game built with React Three Fiber and Rapier3D physics engine.

## Directory Structure

### Core Files
- **App.tsx** - Main application component that sets up the game shell with GameProvider context, Battlefield scene, HUD, controls, and debug overlay
- **main.tsx** - Application entry point that initializes React root, installs GL/GLTF patches, and renders the App component

### Key Subdirectories

| Directory | Purpose |
|-----------|---------|
| **components/** | React components for rendering the game scene (ships, environment, effects, HUD) |
| **game/** | Core game logic including AI, physics, combat systems, state management, and progression |
| **renderer/** | Three.js rendering infrastructure (materials, shaders, texture atlases, post-processing setup) |
| **types/** | TypeScript type definitions and interfaces for the entire application |
| **hooks/** | Custom React hooks for game logic integration (interpolation, shader compilation, textures) |
| **config/** | Configuration parameters for game features (effects, explosions, shields, postprocessing) |
| **data/** | Game data and ship statistics |
| **utils/** | Utility functions (RNG, color, steering, motion, geometry, GLTF patching) |
| **assets/** | Game assets (3D models, textures, planets, skysphere) |
| **styles/** | CSS styling for the application |
| **debug/** | Debug UI components and panels |

## Architecture Overview

### Game Flow
1. **Entry Point** (`main.tsx`) → Initializes patches and React
2. **App Component** (`App.tsx`) → Sets up GameProvider and main scene components
3. **GameProvider** (`game/context.tsx`) → Manages global game state using Miniplex ECS
4. **Battlefield** (`components/Battlefield.tsx`) → Main scene component with React Three Fiber
5. **Systems** (`game/systems/`) → Runs game logic (AI, physics, combat, projectiles)
6. **Components** (`components/`) → Renders game entities (ships, environment, effects)
7. **HUD** (`components/Hud.tsx`) → Displays player interface and information

### State Management
- Centralized `GameState` type defined in `types/index.ts`
- ECS (Entity Component System) managed by Miniplex for component organization
- Deterministic RNG using seeded random number generator (`utils/rng.ts`)

### Rendering Pipeline
- React Three Fiber for React-style 3D component declarations
- Three.js materials and shaders managed via material registry
- Instanced rendering for performance (projectiles, ships, thrusters, debris)
- Post-processing effects (bloom, chromatic aberration, tone mapping)
- LOD (Level of Detail) management for distant objects

### Physics & Simulation
- Rapier3D physics engine for collision and dynamics
- Deterministic simulation running on main thread
- Smooth interpolation for rendering between physics updates
- AI steering and navigation using custom algorithms

## Development Guidelines

### Coding Standards
- Use TypeScript with explicit types for public APIs
- Import shared types from `src/types/index.ts`
- Follow 2-space indentation and use semicolons
- Keep deterministic behavior by using seeded RNG
- Avoid module-level state; use `GameState` for runtime state
- Comment intent and constraints, not obvious mechanics

### Testing & Validation
- Run `npm run typecheck` to validate types
- Run `npm test` to execute unit tests (Vitest)
- Use `npm run build` to compile to dist/
- Tests are in `test/` directory with `.spec.ts` extension

### Asset Management
- Cache GLTF files using `@react-three/drei`'s `useGLTF`
- Dispose custom Three.js resources to prevent memory leaks
- Use material registry for centralized material management

## Key Technologies

- **React** - UI framework
- **React Three Fiber** - React renderer for Three.js
- **Three.js** - 3D graphics library
- **Rapier3D** - Physics engine
- **Miniplex** - ECS library for entity management
- **TypeScript** - Type-safe development
- **Vitest** - Unit testing framework
- **Playwright** - E2E testing framework

## For More Information

- See `AGENTS.md` in this directory for folder-specific agent guidelines
- See `../AGENTS.md` for repository-wide conventions
- See `../memory/` for project memory bank and documentation
- See `../spec/` for architecture specifications
