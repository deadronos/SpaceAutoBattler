# types/ - TypeScript Type Definitions

Central TypeScript type definitions and interfaces used throughout the application.

## Core Type Files

| File               | Purpose                                                                               |
| ------------------ | ------------------------------------------------------------------------------------- |
| **index.ts**       | Main type export barrel; re-exports the canonical types from the modules below        |
| **core.ts**        | Core primitives: `EntityId`, `Archetype`, and Rapier module/type re-exports           |
| **ai.ts**          | AI system types (profiles, traits, decisions, intents)                                |
| **combat.ts**      | Combat system types (damage, weapons, ammo)                                           |
| **gameplay.ts**    | Gameplay types (events, commands, UI state)                                           |
| **progression.ts** | Progression system types (XP, leveling, talents)                                      |
| **ship.ts**        | Ship entity types (properties, state, weapons)                                        |
| **renderer.ts**    | Renderer types (materials, layers, effects)                                           |
| **simulation.ts**  | Simulation types including the canonical `GameState` (physics, projectiles, entities) |

## Type Definition Files (Ambient)

| File                          | Purpose                                                     |
| ----------------------------- | ----------------------------------------------------------- |
| **assets.d.ts**               | Type definitions for asset imports (GLTF, textures)         |
| **react-three-drei.d.ts**     | Type extensions for React Three Drei library                |
| **three-stdlib-ambient.d.ts** | Ambient type declarations for Three.js stdlib               |
| **glsl.d.ts**                 | Type definitions for GLSL shader imports                    |
| **n8ao.d.ts**                 | Ambient declarations for the `n8ao` post-processing package |

## Subdirectories

### [ai/](./ai/) - AI Subsystem Types

Focused AI declarations (`blackboard.ts`, `doctrine.ts`, `interrupts.ts`,
`metrics.ts`, `metrics-snapshots.ts`, `sensors.ts`, `state.ts`).

## Central GameState

The `GameState` type defined in `simulation.ts` (re-exported from `index.ts`) is the canonical source of truth for:

- All active ships
- Active projectiles
- Combat events
- AI state
- Progression data

All systems work with GameState as their primary interface.

## Type Usage Pattern

- Import types from `src/types/index.ts`
- Use explicit types for public APIs
- Avoid module-level state outside GameState
- Leverage TypeScript for compile-time validation

## Performance Notes

- Types are zero-runtime overhead
- Used only for development and compilation
- No runtime type checking (all stripped in build)
