# SpaceAutoBattler - Source Code Structure Specification

## Overview

This specification documents the complete structure and organization of the `/src` directory for the SpaceAutoBattler game. The codebase follows a modular, configuration-driven architecture designed for a space-themed real-time strategy game with red vs blue team fleets.

## Directory Structure

### `/src` - Root Source Directory

The source code is organized into logical modules with clear separation of concerns:

```text
src/
├── main.ts                 # Application entry point and main game loop
├── simWorker.ts           # Web Worker for simulation processing
├── ui.html               # Main UI template
├── config/               # Configuration-driven game parameters
├── core/                 # Core game logic and state management
├── renderer/             # Three.js rendering system
├── types/                # TypeScript type definitions
├── utils/                # Shared utility functions
└── styles/               # CSS stylesheets
```

## Module Breakdown

### Entry Points

#### `main.ts`
**Purpose**: Main application entry point and game loop coordinator

**Responsibilities**:
- Initialize the application and load required assets
- Set up the main game loop (simulation + rendering)
- Manage application lifecycle (loading, running, paused states)
- Coordinate between simulation worker and renderer
- Handle user input and UI interactions

**Key Functions**:
- `initializeGame()` - Set up Three.js scene, load configs, initialize workers
- `gameLoop()` - Main update loop at 60 FPS
- `startSimulation()` / `pauseSimulation()` - Control simulation state
- `spawnFleet()` - Manual ship spawning for testing

#### `simWorker.ts`
**Purpose**: Web Worker for deterministic simulation processing

**Responsibilities**:
- Run physics simulation and AI logic in separate thread
- Maintain deterministic simulation state using seeded RNG
- Process ship AI, turret targeting, bullet physics
- Handle collision detection and damage calculation
- Communicate simulation updates back to main thread

**Key Features**:
- Isolated from rendering thread for consistent 60 TPS
- Uses seeded RNG for deterministic replay capability
- Processes AI decision-making and physics calculations

### Configuration System (`/src/config/`)

The configuration system provides a centralized, data-driven approach to game balance and behavior:

#### `behaviorConfig.ts`
**Purpose**: AI behavior and personality configuration

**Contains**:
- `AIPersonality` definitions for each ship class
- Team modifiers for red/blue team behavior variations
- Formation configurations and spacing
- Roaming patterns for AI movement
- Turret AI settings and targeting behavior

**Key Exports**:
- `DEFAULT_PERSONALITIES` - AI traits per ship class
- `DEFAULT_FORMATIONS` - Fleet formation patterns
- `getEffectivePersonality()` - Apply team modifiers to base personality

#### `entitiesConfig.ts`
**Purpose**: Ship and turret entity definitions

**Contains**:
- Ship class configurations (health, armor, speed, turrets)
- Turret configurations (damage, range, cooldown)
- Ship progression stats and capabilities
- Carrier fighter spawning parameters

**Key Exports**:
- `SHIP_CLASS_CONFIGS` - Complete ship definitions
- `TURRET_CONFIGS` - Turret specifications
- `getShipClassConfig()` / `getTurretConfig()` - Access functions

#### `progression.ts`
**Purpose**: XP and leveling system configuration

**Contains**:
- XP calculation functions and rates
- Level progression curves
- Stat scaling formulas
- Level-up bonuses and multipliers

**Key Exports**:
- `XP_PER_DAMAGE` / `XP_PER_KILL` - XP reward rates
- `nextLevelXp()` - Calculate XP requirements
- `applyLevelUps()` - Apply level-based stat bonuses

#### `gameConfig.ts`
**Purpose**: Global game parameters and constants

**Contains**:
- Simulation boundaries and world size
- Global timing constants (FPS, TPS)
- Game rules and constraints
- Default game state parameters

#### `rendererConfig.ts`
**Purpose**: Three.js rendering configuration

**Contains**:
- Camera settings and viewport configuration
- Visual effects parameters
- Asset loading and management settings
- Performance optimization settings

#### `simConfig.ts`
**Purpose**: Simulation engine configuration

**Contains**:
- Physics simulation parameters
- AI update frequencies
- Collision detection settings
- Performance tuning parameters

#### `assets/` - Asset Configuration
**Purpose**: Game asset definitions and loading configuration

**Structure**:

```text
assets/
└── svg/                    # Ship SVG assets
    ├── fighter.svg
    ├── corvette.svg
    ├── frigate.svg
    ├── destroyer.svg
    └── carrier.svg
```

**Purpose**: Vector graphics for ship models, extruded into 3D meshes

### Core Game Logic (`/src/core/`)

#### `gameState.ts`

**Purpose**: Central game state management and entity definitions

**Contains**:

- `GameState` type definition - Complete game world state
- Ship, turret, bullet, and effect entity definitions
- Game state manipulation functions
- State reset and initialization utilities

**Key Types**:

- `GameState` - Root state object containing all game entities
- `Ship` - Individual ship with position, health, turrets
- `Turret` - Weapon system with targeting and firing logic
- `Bullet` - Projectile with physics and damage
- `AssetPool` - Resource management for textures and effects

**Key Functions**:

- `createInitialState()` - Initialize empty game state
- `resetState()` - Clear and reinitialize state
- `spawnShip()` - Create new ship entity
- `spawnFleet()` - Create multiple ships with random classes

#### `aiController.ts`

**Purpose**: AI decision-making and behavior control

**Contains**:

- Ship AI personality application
- Intent evaluation and decision-making
- Formation movement logic
- Turret targeting algorithms
- Fleet coordination systems

**Key Functions**:

- `updateShipAI()` - Process AI for individual ships
- `evaluateIntent()` - Determine ship behavior based on personality
- `calculateFormationPosition()` - Formation movement calculations
- `selectTurretTarget()` - AI turret targeting logic

### Rendering System (`/src/renderer/`)

#### `threeRenderer.ts`

**Purpose**: Three.js-based 3D rendering engine

**Contains**:

- Three.js scene setup and management
- Ship model rendering from SVG assets
- Particle effects and visual feedback
- Camera controls and viewport management
- Performance optimization for 60 FPS rendering

**Key Components**:

- Scene graph management
- Material and texture handling
- Lighting and post-processing effects
- Ship model generation from SVG
- Bullet trail and explosion effects

### Type Definitions (`/src/types/`)

#### `index.ts`

**Purpose**: Centralized TypeScript type definitions

**Contains**:

- Core game entity types (Ship, Turret, Bullet, etc.)
- Configuration type definitions
- Team and ship class enumerations
- Vector3 and other utility types
- Event and message type definitions

**Key Types**:

- `ShipClass` - Fighter, Corvette, Frigate, Destroyer, Carrier
- `Team` - Red, Blue team enumeration
- `Vector3` - 3D position and vector mathematics
- `GameConfig` - Complete configuration type
- `AssetPool` - Resource management types

### Utilities (`/src/utils/`)

#### `rng.ts`

**Purpose**: Seeded random number generation for deterministic gameplay

**Contains**:

- Seeded RNG implementation
- Random selection utilities
- Statistical distribution functions
- Deterministic shuffle and sampling

**Key Functions**:

- `createRNG()` - Initialize seeded random number generator
- `pick()` / `pickWeighted()` - Random selection from arrays
- `shuffle()` - Deterministic array shuffling
- `randomFloat()` / `randomInt()` - Bounded random number generation

### Styles (`/src/styles/`)

#### `ui.css`

**Purpose**: User interface styling and layout

**Contains**:

- Game UI component styles
- Control panel layouts
- HUD and overlay styling
- Responsive design for different screen sizes
- Theme and color scheme definitions

## Architecture Principles

### Configuration-Driven Design

- All game balance parameters are externalized to configuration files
- Changes to ship stats, AI behavior, or game rules require only config updates
- Supports modding and balance iteration without code changes
- Configuration validation ensures game balance integrity

### Separation of Concerns

- **Simulation** (`simWorker.ts`, `core/`) - Physics, AI, game logic
- **Rendering** (`renderer/`) - Visual representation and effects
- **Configuration** (`config/`) - Game balance and parameters
- **Main Loop** (`main.ts`) - Coordination and user interaction

### Deterministic Simulation

- Seeded RNG ensures reproducible gameplay
- Simulation runs independently of rendering frame rate
- Web Worker isolation prevents UI blocking
- Fixed timestep (60 TPS) for consistent physics

### Modular Entity System

- All game entities inherit from base types in `GameState`
- Entity pooling for performance optimization
- Type-safe entity manipulation through TypeScript
- Clear ownership and lifecycle management

## Data Flow

1. **Initialization**: `main.ts` loads configs and initializes renderer + worker
2. **Game Loop**: 60 FPS loop coordinates simulation and rendering
3. **Simulation**: Worker processes AI, physics, and updates `GameState`
4. **Rendering**: Main thread renders current `GameState` to Three.js scene
5. **User Input**: UI interactions modify game state or configuration

## Configuration Integration

All modules reference configuration through:

- Direct imports from `/src/config/` files
- Type-safe configuration access functions
- Runtime configuration validation
- Hot-reload capability for development

## Performance Considerations

- **Web Worker**: Simulation runs in separate thread
- **Asset Pooling**: Reusable resources for effects and models
- **LOD System**: Level-of-detail for distant objects
- **Culling**: Frustum culling for off-screen objects
- **Batching**: Efficient Three.js rendering batches

## Development Workflow

1. **Balance Changes**: Modify `/src/config/` files
2. **New Features**: Add to appropriate module (`core/`, `renderer/`, etc.)
3. **Testing**: Update `/test/vitest/` specs to match new functionality
4. **Build**: Generate bundled output in `/dist/`

## Future Extensions

This structure supports:

- Additional ship classes through config
- New AI behaviors via personality system
- Enhanced visual effects in renderer
- Multiplayer support through state synchronization
- Mod support via configuration overrides

## References

This specification should be referenced by:

- `/agents.md` - Agent behavior guidelines
- `/copilot-instructions.md` - AI coding assistant rules
- `/test/vitest/README.md` - Test suite documentation
- Development workflow documentation
