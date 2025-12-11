# SpaceAutoBattler Architecture

**Version:** 0.1.0  
**Last Updated:** 2025-10-29

## Overview

SpaceAutoBattler is a deterministic 3D space combat simulator built with strict separation between pure simulation logic and rendering/UI concerns. This architecture enables reproducible tests, headless benchmarking, and visual regression validation.

## Core Architectural Principles

### 1. Determinism First

- **Single Source of Randomness**: All simulation randomness flows through `state.rng` (seeded RNG in `src/utils/rng.ts`, default seed: 1337)
- **Canonical State**: Runtime state lives exclusively in `GameState` (`src/types/index.ts`)
- **No Module-Level State**: Avoid global mutable state that could break determinism
- **Reproducible Execution**: Same seed + same inputs = identical outcomes across runs

### 2. Simulation/Renderer Separation

```
┌─────────────────────────────────────────────────────────┐
│                    Presentation Layer                    │
│   React Components + R3F + Three.js (src/components/)   │
│        ↓ Read Only                                       │
└──────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│                     Simulation Core                      │
│    Pure Logic: ECS + Rapier Physics (src/game/)         │
│    Updates GameState deterministically each tick         │
└─────────────────────────────────────────────────────────┘
```

- **Simulation** (`src/game/`): Deterministic, pure logic running at fixed timestep (1/20s default)
- **Renderer** (`src/components/`, `src/renderer/`): Side-effect free visualization reading from `GameState`
- **Clear Boundary**: Renderer never mutates simulation state directly

### 3. Entity Component System (ECS)

- **Library**: Miniplex v2 (lightweight ECS)
- **Entity Management**: `state.world` manages all entities (ships, projectiles, turrets)
- **Queries**: Systems use archetype queries to efficiently process entities
- **Lifecycle**: `createEntity()` / `destroyEntity()` helpers ensure proper cleanup

### 4. Physics Integration

- **Engine**: Rapier3D (deterministic 3D physics)
- **Threading**: Runs on main thread, stepped synchronously in simulation loop
- **Safe Mutations**: Deferred mutation queues (`state.simulation.deferredMutations`, `state.simulation.postStepMutations`) prevent mid-step corruption
- **Diagnostics**: `state.simulation.rapierDiagnostics` tracks guard trips and step panics

## High-Level Directory Structure

```
src/
├── main.tsx                  # Application entry point, React bootstrap
├── App.tsx                   # Top-level React component, canvas + HUD
│
├── game/                     # Pure simulation logic (deterministic)
│   ├── state.ts              # GameState factory (createGameState/disposeGameState)
│   ├── systems.ts            # System orchestrator (updateGame pipeline)
│   ├── systems/              # Per-domain system implementations
│   │   ├── motion.ts         # Velocity integration, transform updates
│   │   ├── combat.ts         # Engagement coordination, target selection
│   │   ├── carriers.ts       # Fighter launch/recovery, escort behavior
│   │   ├── projectiles.ts    # Projectile lifecycle, collision detection
│   │   ├── shipControl.ts    # AI execution, weapon firing, movement
│   │   ├── sensors.ts        # Target detection and tracking
│   │   ├── sync.ts           # Renderer synchronization data prep
│   │   ├── turrets.ts        # Turret aiming and firing logic
│   │   └── decision/         # AI decision-making subsystems
│   │       ├── manager.ts    # Intent evaluation and prioritization
│   │       ├── blackboard.ts # Shared AI data structures
│   │       ├── intents.ts    # Intent type definitions
│   │       └── *-intents.ts  # Combat/tactical/formation intent logic
│   ├── physics/              # Rapier integration and safe wrappers
│   │   ├── index.ts          # Physics world initialization
│   │   ├── safeKinematics.ts # Safe transform setters for systems
│   │   ├── mutationHelpers.ts# Deferred mutation utilities
│   │   └── types.ts          # Physics-related type definitions
│   ├── progression/          # Ship XP, leveling, upgrades
│   │   ├── xp.ts             # Experience point calculations
│   │   ├── leveling.ts       # Level-up logic and stat bonuses
│   │   └── events.ts         # Progression event handling
│   ├── combat/               # Combat mechanics
│   │   └── damage.ts         # Damage calculation and application
│   ├── utils/                # Simulation utilities
│   ├── ships.ts              # Ship spawning, blueprints, stats
│   ├── explosions.ts         # Explosion event management
│   ├── metrics.ts            # AI performance metrics tracking
│   ├── aiProfiles.ts         # AI behavior presets and seeds
│   ├── aiTraits.ts           # Deterministic trait generation
│   ├── aiDoctrine.ts         # AI strategic doctrine definitions
│   ├── aiState.ts            # AI state management per entity
│   ├── subsystems.ts         # Ship subsystem definitions
│   ├── turretRegistry.ts     # Turret entity tracking and cleanup
│   ├── simulationQueue.ts    # Deferred mutation queue management
│   ├── uiStore.ts            # Zustand store for UI state (pause, timeScale)
│   └── validation.ts         # Motion stats validation
│
├── components/               # React + R3F rendering components
│   ├── Battlefield.tsx       # Main Three.js canvas, scene setup
│   ├── BattlefieldSystems.tsx# Fixed-step simulation integration
│   ├── Ship.tsx              # Ship render wrapper
│   ├── Turret.tsx            # Turret visual representation
│   ├── Hud.tsx               # Main HUD (team summaries, health bars)
│   ├── Controls.tsx          # UI controls (pause, reset, spawn)
│   ├── Postprocessing.tsx    # Selective bloom + FXAA effects
│   ├── ship/                 # Ship rendering subsystems
│   │   ├── ShipModel.tsx     # GLTF model loading and materials
│   │   ├── ShipShield.tsx    # Shield bubble rendering
│   │   ├── shieldUtils.ts    # Shield fraction calculations
│   │   └── rippleUtils.ts    # Shield ripple processing
│   ├── layers/               # Instanced rendering layers
│   │   ├── ShipsLayer.tsx    # All ships + particle trails
│   │   ├── ProjectilesLayer.tsx # All projectiles
│   │   ├── TurretsLayer.tsx  # All turrets
│   │   └── StarsField.tsx    # Static starfield background
│   ├── explosions/           # Explosion visual effects
│   │   ├── ExplosionRenderer.tsx # Instanced explosion rendering
│   │   ├── derived.ts        # Particle data computation
│   │   ├── constants.ts      # Rendering capacities/lifetimes
│   │   ├── materials.ts      # Explosion shader materials
│   │   └── DynamicLightManager.tsx # Transient explosion lights
│   ├── environment/          # Celestial environment
│   │   ├── CelestialEnvironment.tsx # Planet, star, skysphere wrapper
│   │   ├── PlanetBody.tsx    # Planet mesh and textures
│   │   ├── PlanetRings.tsx   # Planetary ring system
│   │   ├── StarDisk.tsx      # Star disk rendering
│   │   └── Skysphere.tsx     # Background skysphere
│   ├── postprocessing/       # Postprocessing pipeline
│   │   ├── buildEffects.ts   # Effect pass construction (bloom, tone)
│   │   └── createComposer.ts # Composer setup and wiring
│   ├── thrusters/            # Ship thruster effects
│   ├── debris/               # Debris system components
│   └── lod/                  # Level of detail management
│
├── renderer/                 # Rendering utilities and systems
│   ├── BloomProvider.tsx     # Selective bloom registration context
│   ├── materialRegistry.tsx  # Entity shader material caching
│   ├── hudOverlayStore.ts    # HUD overlay positioning and sync
│   ├── starDiskMaterial.ts   # Main sequence star shader
│   ├── starDiskOrientation.ts# Star disk view alignment
│   ├── materials/            # Specialized material implementations
│   ├── particles/            # Particle system utilities
│   ├── shields/              # Shield rendering systems
│   ├── starDisk/             # Star disk rendering subsystem
│   └── shaders/              # GLSL shader source files
│       ├── starDisk.vertex.glsl
│       ├── starDisk.fragment.glsl
│       └── mainsequencestar.glsl
│
├── config/                   # Configuration-driven parameters
│   ├── renderer.ts           # Rendering options, quality presets
│   ├── explosions.ts         # Explosion visual configurations
│   ├── projectiles.ts        # Projectile appearance and physics
│   ├── hudHealth.ts          # HUD health bar styling
│   ├── progression.ts        # XP, leveling, damage type configs
│   ├── environment.ts        # Celestial body configurations
│   ├── carriers.ts           # Carrier launch system parameters
│   └── experiments.ts        # AI experiment flags and overrides
│
├── types/                    # TypeScript type definitions
│   ├── index.ts              # Core types: GameState, entities, AI
│   ├── assets.d.ts           # Asset module declarations
│   ├── glsl.d.ts             # GLSL shader module types
│   ├── jsx-compat.d.ts       # React 19 JSX compatibility
│   └── *.d.ts                # Various ambient declarations
│
├── utils/                    # Shared utilities
│   ├── rng.ts                # Seeded RNG (deterministic randomness)
│   ├── deterministicLerp.ts  # Seeded interpolation
│   ├── color.ts              # Color conversion utilities
│   └── patchGltfLoader.ts    # GLTFLoader runtime patches
│
├── hooks/                    # React custom hooks
│   ├── useShipInterpolation.ts  # Smooth ship motion for rendering
│   ├── useShipThrusters.ts      # Thruster glow material management
│   ├── usePlanetTexture.ts      # Planet texture loading
│   ├── useArchetypeEntities.ts  # ECS archetype subscriptions
│   └── usePrefersReducedMotion.ts # Accessibility motion detection
│
├── assets/                   # Static asset manifests and data
│   ├── ships.ts              # Ship GLTF model paths
│   ├── planets.ts            # Planet texture paths
│   ├── skysphere.ts          # Skysphere texture paths
│   ├── starDiskTextures.ts   # Star disk texture paths
│   ├── gltf/                 # Local GLTF models
│   └── textures/             # Supplemental texture assets
│
├── data/                     # Game data and configurations
│   └── ships/                # Ship blueprint definitions
│
├── styles/                   # Global CSS
│   └── app.css               # HUD, overlays, layout styles
│
└── debug/                    # Debug and development tools
    └── RingDebugPanel.tsx    # Ring system debug interface
```

## Core Concepts

### GameState: The Single Source of Truth

`GameState` (defined in `src/types/index.ts`) is the canonical container for all runtime state:

```typescript
interface GameState {
  world: World;              // Miniplex ECS world
  physicsWorld: Rapier.World;// Rapier physics world
  eventQueue: Rapier.EventQueue;
  rng: SeededRng;            // Deterministic RNG (seed: 1337)
  simulation: {
    step: number;            // Fixed timestep (default: 1/20s)
    maxSubSteps: number;     // Max physics substeps (default: 5)
    deferredMutations: Array<...>; // Queued physics mutations
    postStepMutations: Array<...>; // Post-physics-step mutations
    rapierDiagnostics: {...};      // Physics diagnostics
    // ... clock state, tick counters
  };
  turretsByShip: Map<...>;   // Turret->Ship ownership mapping
  // ... team stats, metrics, explosion events, etc.
}
```

**Lifecycle**:

- **Creation**: `createGameState(seed?)` initializes Rapier, ECS world, RNG
- **Update**: `updateGame(state, delta)` steps simulation forward
- **Disposal**: `disposeGameState(state)` cleans up Rapier/Three.js resources

### Deterministic RNG

The `SeededRng` class (`src/utils/rng.ts`) provides deterministic randomness:

```typescript
const rng = new SeededRng(1337); // Seed controls entire sequence
rng.next(); // [0, 1) uniform random
rng.range(min, max); // Uniform in [min, max)
rng.int(min, max); // Integer in [min, max]
rng.pick(array); // Random element from array
rng.normal(mean, stdDev); // Gaussian distribution (Box-Muller)
```

**Usage**: All simulation logic must use `state.rng` for randomness—never `Math.random()`—to ensure replay determinism.

### System Pipeline

The `updateGame(state, delta)` function in `src/game/systems.ts` orchestrates the simulation:

1. **Preparation**: Process deferred mutations, update AI blackboards
2. **Physics Step**: Rapier world steps forward (`physicsWorld.step()`)
3. **Systems Execution**: Sequential system updates
   - Motion system: Integrate velocities, update transforms
   - Sensors: Update target tracking
   - Ship control: Execute AI decisions, apply thrust/weapons
   - Combat: Resolve engagements, arbitrate targets
   - Projectiles: Update trajectories, detect collisions
   - Carriers: Manage fighter launches and recoveries
   - Turrets: Update turret states and firing
4. **Post-Step**: Apply post-step mutations, sync renderer data
5. **Cleanup**: Process entity destruction, explosion events

Each system is a pure function reading and updating `GameState`.

### Physics Integration (Rapier3D)

**Key Constraints**:

- Rapier runs synchronously on the main thread
- Mutable-borrow safety: Don't modify physics objects during step
- **Solution**: Deferred mutation queues

**Safe Mutation Pattern**:

```typescript
import { scheduleDeferredMutation } from './simulationQueue';

// Instead of directly mutating:
// rigidbody.setTranslation({ x, y, z }); // ❌ May panic mid-step

// Use deferred mutation:
scheduleDeferredMutation(state, {
  type: 'setTranslation',
  rigidbody,
  position: { x, y, z },
}); // ✅ Applied safely between steps
```

Helpers in `src/game/physics/safeKinematics.ts` wrap common operations.

### AI Decision System

**Architecture**: Intent-based AI with blackboard pattern

```
Decision Flow:
  1. Blackboard updates (shared AI state)
  2. Intent generation (combat, tactical, formation)
  3. Intent scoring and prioritization
  4. Intent execution (movement, weapons, abilities)
```

**Key Files**:

- `src/game/systems/decision/manager.ts` - Intent evaluation coordinator
- `src/game/systems/decision/blackboard.ts` - Shared AI data structures
- `src/game/systems/decision/*-intents.ts` - Intent generation logic
- `src/game/aiProfiles.ts` - Predefined AI behavior profiles
- `src/game/aiTraits.ts` - Deterministic trait generation from seeds

### Rendering Pipeline

**R3F Integration**: React Three Fiber wraps Three.js in React components

```
Battlefield.tsx (Canvas root)
  ├─ Lighting setup
  ├─ BattlefieldSystems (simulation loop integration)
  ├─ ShipsLayer (instanced ship meshes)
  ├─ ProjectilesLayer (instanced projectiles)
  ├─ TurretsLayer (turret entities)
  ├─ ExplosionRenderer (instanced explosions)
  ├─ ParticleTrails (engine exhaust)
  ├─ CelestialEnvironment (planet, star, skysphere)
  ├─ StarsField (background stars)
  └─ Postprocessing (selective bloom, FXAA)
```

**Key Patterns**:

- **Instancing**: Large entity groups (ships, projectiles) use `THREE.InstancedMesh` for performance
- **Material Registry**: Shared materials cached in `src/renderer/materialRegistry.tsx`
- **Selective Bloom**: Entities register for bloom layer via `BloomProvider` context
- **LOD**: Level-of-detail switching for distant objects
- **Interpolation**: Smoothing hooks (`useShipInterpolation`) hide fixed-timestep judder

### Explosion System

**Lifecycle**:

1. Damage/destruction triggers explosion event in simulation
2. Event stored in `state.explosionEvents` queue
3. `ExplosionRenderer` consumes events, spawns instanced effects
4. `DynamicLightManager` creates transient point lights
5. Particles (debris, sparks, flash) updated each frame
6. Effects expire after configured lifetime

**Configuration**: `src/config/explosions.ts` defines visual parameters

## Data Flow

### Simulation → Renderer

1. **Simulation Tick**: Systems update `GameState`
2. **Sync System**: Prepares renderer-friendly data (e.g., interpolated positions)
3. **React Components**: Read from `GameState` via `useGameContext()` hook
4. **R3F Frame**: Components update Three.js scene graph
5. **Render**: Three.js renders to WebGL canvas

**One-Way Flow**: Renderer only reads, never writes to simulation state.

### User Input → Simulation

1. **UI Event**: User clicks button (pause, spawn ship, etc.)
2. **Event Handler**: Updates `uiStore` (Zustand) or calls simulation API
3. **Simulation**: Processes command, updates `GameState`
4. **Renderer**: Reflects changes on next frame

## Configuration System

All tunable parameters live in `src/config/`:

- **renderer.ts**: Postprocessing toggles, quality presets, rendering options
- **explosions.ts**: Explosion effect parameters (scale, duration, particle counts)
- **projectiles.ts**: Projectile visuals, collider sizes, speeds
- **hudHealth.ts**: Health bar colors, animations, status effects
- **progression.ts**: XP curves, level bonuses, damage type multipliers
- **environment.ts**: Planet sizes, star colors, skysphere settings
- **carriers.ts**: Fighter launch queues, bay capacities, escort behavior
- **experiments.ts**: Feature flags for AI experiments

**Philosophy**: Edit configs instead of hardcoding values in source files.

## Testing Architecture

### Unit Tests (Vitest)

- **Location**: `test/vitest/`
- **Focus**: Pure logic, deterministic behavior, system integration
- **Environment**: `happy-dom` (lightweight browser-like environment)
- **Key Patterns**:
  - Seed RNG for reproducible tests
  - Small `GameState` instances for focused tests
  - Test hooks (`__aiTestHooks`) for internal system validation

### E2E Tests (Playwright)

- **Location**: `test/playwright/`
- **Focus**: Visual regression, user flows, rendering correctness
- **Baselines**: `playwright-debug/` stores reference screenshots
- **Determinism**: Uses same seed and debug overrides as unit tests

### Running Tests

```powershell
npm run typecheck          # TypeScript type checking
npm test                   # Vitest unit tests
npm run test:playwright    # Playwright E2E tests
npm run perf:ai-budget     # AI performance budget assertions
```

## Build and Deployment

### Development

```powershell
npm install                # Install dependencies
npm start                  # Webpack dev server (http://localhost:8080)
```

**Features**: Hot reload, source maps, React Fast Refresh

### Production Build

```powershell
npm run build              # Webpack production build → dist/
npm run serve              # Serve dist/ on http://localhost:8080
```

**Optimizations**: Minification, tree shaking, code splitting

### Deployment (GitHub Pages)

Automatic deployment on git tag push:

```powershell
git tag v1.0.0
git push origin v1.0.0     # Triggers GitHub Actions workflow
```

**Workflow**: Runs typecheck + tests → builds → deploys to GitHub Pages

## Key Architectural Patterns

### 1. Pure Functions and Immutability

Systems are pure functions: `(GameState, delta) => GameState` mutations.

### 2. Deferred Mutations

Rapier-sensitive operations queued and applied between physics steps.

### 3. Component Composition

React components composed hierarchically; hooks extract reusable logic.

### 4. Configuration Over Code

Tunable parameters in `src/config/` rather than hardcoded values.

### 5. Separation of Concerns

- **Game logic**: No rendering code
- **Renderer**: No simulation logic
- **Types**: Centralized in `src/types/`
- **Utilities**: Shared helpers in `src/utils/`

### 6. Resource Lifecycle Management

- GLTFs loaded via `useGLTF` (cached)
- Manual Three.js objects disposed in `disposeGameState()`
- Turret registry tracks entity relationships for cascade cleanup

### 7. Performance Optimization

- Instanced rendering for large entity groups
- Material registry prevents duplicate shader compilation
- Allocation-free hot paths (motion, projectiles)
- Selective bloom reduces overdraw
- LOD system for distant objects

## Extension Points

### Adding a New System

1. Create system file in `src/game/systems/`
2. Export system function: `(state: GameState, delta: number) => void`
3. Register in `src/game/systems.ts` `updateGame()` pipeline
4. Add tests in `test/vitest/`

### Adding a New Ship Type

1. Define blueprint in `src/data/ships/`
2. Add GLTF model path to `src/assets/ships.ts`
3. Update ship stats and abilities in blueprint
4. Add test coverage for new ship behavior

### Adding a New Weapon Type

1. Add projectile configuration in `src/config/projectiles.ts`
2. Implement weapon logic in `src/game/systems/shipControl/weapons.ts`
3. Add projectile system handling in `src/game/systems/projectiles/`
4. Create visual representation in `src/components/layers/ProjectilesLayer.tsx`

### Adding a New AI Behavior

1. Define AI profile in `src/game/aiProfiles.ts`
2. Implement intent generation in `src/game/systems/decision/*-intents.ts`
3. Update intent scoring in `src/game/systems/decision/manager.ts`
4. Add behavior tests in `test/vitest/`

## Performance Considerations

### Hot Path Optimization

- **Avoid Allocations**: Reuse temp vectors, use object pools
- **Batch Operations**: Group similar operations (instanced rendering)
- **Early Exits**: Short-circuit expensive checks when possible

### Memory Management

- **Dispose Resources**: Clean up Three.js geometries/materials
- **Limit Buffer Growth**: Cap ripple/effect buffers per entity
- **Cache Lookups**: Use `turretsByShip` map for O(1) lookups

### Rendering Performance

- **Instancing**: Use `InstancedMesh` for numerous similar objects
- **Material Sharing**: Register materials in `materialRegistry`
- **Frustum Culling**: Three.js culls off-screen objects automatically
- **LOD Switching**: Reduce detail for distant objects
- **Selective Bloom**: Only bloom-enabled layers incur postprocessing cost

## Debugging and Development Tools

### In-Game Overlays

- **Performance Monitor**: `PerfMonitorOverlay` (r3f-perf integration)
- **AI Debug Overlay**: `AiDebugOverlay` shows AI state and decisions
- **Explosion Debug**: `ExplosionDebugOverlay` tracks explosion events
- **Progression Panel**: `ProgressionPanel` for XP/level debugging

### Console Utilities

```javascript
// Access GameState in browser console (when exposed)
window.__gameState; // Current simulation state
state.rng.reset(42); // Change RNG seed mid-game (breaks determinism!)
state.simulation.rapierDiagnostics; // Physics diagnostics
```

### Development Scripts

```powershell
npm run lint              # ESLint check
npm run lint:fix          # Auto-fix lint issues
npm run format            # Prettier formatting
npm run bench:projectiles # Projectile stress benchmark
```

## Common Gotchas and Best Practices

### ❌ Don't

- Use `Math.random()` in simulation code (breaks determinism)
- Mutate Rapier objects during physics step (use deferred queues)
- Store state in module-level variables (use `GameState`)
- Edit files in `dist/` (they're build artifacts)
- Remove tests for unrelated functionality

### ✅ Do

- Use `state.rng` for all simulation randomness
- Schedule physics mutations via `scheduleDeferredMutation()`
- Store all state in `GameState`
- Edit source files in `src/` only
- Run `npm run typecheck && npm test` before committing
- Add tests for new behavior
- Dispose Three.js resources in cleanup code
- Use existing config values in `src/config/`

## Related Documentation

- **Source Structure**: `spec/src-structure.md` - Detailed file-by-file breakdown
- **Motion Spec**: `spec/spec-physical-movement.md` - Movement system specification
- **README**: `README.md` - Quick start and development workflow
- **Memory Bank**: `memory/` - Design decisions, context, task tracking
- **AI System**: `docs/ai-v2-overview.md` - AI decision system details

## Version History

- **0.1.0** (2025-10-29): Initial architecture documentation

---

For more detailed file-level documentation, see `spec/src-structure.md`.  
For quick reference, see `README.md` and `QUICK_REFERENCE_AI_SYSTEM.md`.
