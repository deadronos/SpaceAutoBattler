# SpaceAutoBattler

[![Gameplay preview — click to open VideoCapture.gif](VideoCapture.gif)](VideoCapture.gif)

A **3D space auto-battler simulation** featuring deterministic fleet combat between Red and Blue teams in a vast cubic battlefield. Experience tactical space warfare with procedurally generated starfields, dynamic ship formations, and immersive 3D camera controls.

## 🎯 Game Theme

**Epic Space Fleet Warfare** - Command massive armadas in a 3D theater of war where strategy meets real-time tactical combat. Witness the ballet of battle as AI-controlled ships maneuver through deep space, unleashing devastating barrages while carriers deploy squadrons of nimble fighters.

### Core Gameplay Loop
- **Red vs Blue** - Two opposing fleets clash in a 1920×1920×1920 unit cubic battlefield
- **Ship Classes** - Fighters, Corvettes, Frigates, Destroyers, and mighty Carriers
- **Dynamic Combat** - Real-time AI-driven ship maneuvers, targeting, and tactical formations
- **Level Progression** - Ships gain XP from combat, unlocking enhanced capabilities
- **Carrier Operations** - Capital ships deploy fighter squadrons for overwhelming local superiority

## 🎮 Game Scope

### Current Features
- **3D Space Environment** - Fully immersive cubic battlefield with procedural deep space skybox
- **Fleet Composition** - 5 distinct ship classes with unique combat roles and capabilities
- **AI Combat System** - Deterministic ship AI with targeting, maneuvering, and tactical behavior
- **Real-time Simulation** - Fixed timestep physics with configurable speed multipliers (0.5x to 4x)
- **Interactive Camera** - Full 3D camera controls with cinematic reset functionality
- **Visual Effects** - Shield impacts, weapon fire, particle effects, and atmospheric boundaries
- **Boundary Behaviors** - Configurable ship/bullets responses (bounce/wrap/remove)
- **Performance Monitoring** - Real-time FPS and entity count tracking

### Technical Capabilities
- **Deterministic Simulation** - Seeded RNG ensures reproducible battles
- **Modular Architecture** - Clean separation between simulation, rendering, and UI
- **Configurable Gameplay** - Extensive configuration system for balance tuning
- **Cross-platform** - Runs in any modern web browser with WebGL support
- **Development Tools** - Comprehensive testing suite and build system

## 🏗️ Architecture: Clean Separation of Concerns

SpaceAutoBattler follows a **strict architectural pattern** that separates simulation logic from rendering and UI concerns, enabling robust testing, modding, and performance optimization.

### Core Principles
- **Single Source of Truth** - All state lives in the canonical `GameState` object
- **Pure Simulation** - Game logic runs independently of rendering or UI
- **Deterministic Execution** - Seeded RNG ensures reproducible results
- **Modular Components** - Each subsystem has clear responsibilities and interfaces

### Architecture Layers

#### 🎲 **Simulation Layer** (`src/core/`)
**Pure game logic with zero rendering dependencies**
- **`gameState.ts`** - Core simulation state management and entity lifecycle
- **`simulateStep()`** - Pure function advancing game state by timestep
- **Deterministic AI** - Ship behavior, targeting, movement, and combat resolution
- **Physics Integration** - 3D position/velocity updates with boundary handling
- **XP & Progression** - Level advancement and stat scaling systems

#### 🎨 **Renderer Layer** (`src/renderer/`)
**Visualization system consuming read-only GameState**
- **`threeRenderer.ts`** - Three.js WebGL renderer implementation
- **Entity Visualization** - Ship models, weapon effects, shield impacts
- **Environmental Effects** - Procedural skybox, boundary wireframes, lighting
- **Performance Optimization** - Instanced rendering and efficient batching
- **Camera System** - 3D camera controls and cinematic positioning

#### 🎮 **Orchestration Layer** (`src/main.ts`)
**Game loop coordination and user interaction**
- **Game Loop** - Fixed timestep simulation with variable rendering
- **UI Management** - Button handlers, speed controls, score display
- **Camera Controls** - Mouse/keyboard input processing and cinematic features
- **State Coordination** - Bridges between simulation and renderer
- **Performance Monitoring** - FPS tracking and entity statistics

#### ⚙️ **Configuration Layer** (`src/config/`)
**Game balance and visual parameters**
- **`simConfig.ts`** - Simulation bounds, tick rate, boundary behaviors
- **`entitiesConfig.ts`** - Ship class stats, weapon systems, progression
- **`rendererConfig.ts`** - Visual settings, effects, camera parameters
- **`progression.ts`** - XP curves and level advancement formulas

#### 📊 **Type System** (`src/types/`)
**Comprehensive TypeScript definitions**
- **`GameState`** - Complete application state interface
- **Entity Types** - Ship, Bullet, and supporting data structures
- **Renderer API** - Clean interface between simulation and visualization
- **Configuration Types** - Strongly typed configuration objects

### Data Flow Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   User Input    │───▶│  Orchestration   │───▶│   Simulation    │
│                 │    │   (main.ts)      │    │  (gameState.ts) │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Camera/State   │    │   Game Loop      │    │   Entity AI     │
│   Updates       │    │   Timing         │    │   & Physics     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                        │
                                                        ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Renderer      │◀───│   GameState      │───▶│   UI Updates    │
│ (threeRenderer) │    │   (Read-only)    │    │   (Stats/Display)│
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### Key Architectural Benefits

#### 🔬 **Testability**
- **Pure Functions** - `simulateStep()` can be tested in isolation
- **Deterministic RNG** - Reproducible test scenarios with seeded randomness
- **Mock Independence** - No rendering dependencies in simulation tests
- **State Snapshots** - Easy serialization for test fixtures

#### ⚡ **Performance**
- **Separation of Concerns** - Simulation runs at fixed timestep, rendering at variable framerate
- **Efficient Rendering** - Only visual state changes trigger GPU updates
- **Scalable Architecture** - Simulation and rendering can be optimized independently
- **Memory Management** - Clear entity lifecycle prevents memory leaks

#### 🔧 **Maintainability**
- **Single Source of Truth** - `GameState` eliminates state synchronization issues
- **Clear Interfaces** - Well-defined contracts between architectural layers
- **Modular Design** - Components can be swapped or extended independently
- **Type Safety** - Comprehensive TypeScript coverage prevents runtime errors

## 🛠️ Technology Stack

### Core Technologies
- **TypeScript 5.9** - Type-safe development with modern ES modules
- **Three.js r179** - High-performance 3D WebGL rendering engine
- **Vite 3.2** - Fast development server and optimized build system
- **Vitest 3.2** - Modern testing framework with native ESM support

### Development & Testing
- **ESLint 9.34** - Code quality and consistency enforcement
- **Prettier 3.6** - Automated code formatting
- **Happy DOM 18.0** - Lightweight DOM testing environment
- **Playwright 1.55** - Cross-browser E2E testing
- **C8 10.1** - Code coverage reporting

### Build & Deployment
- **esbuild 0.25** - Lightning-fast TypeScript compilation
- **HTTP Server 14.1** - Development and testing server
- **Custom Build Scripts** - Standalone HTML generation and asset optimization

### Supporting Libraries
- **Three.js Stdlib 2.36** - Additional Three.js utilities and helpers
- **IDB-Keyval 6.2** - IndexedDB wrapper for client-side storage
- **Lodash 4.17** - Utility functions for data manipulation
- **LRU Cache 11.1** - Memory-efficient caching for performance
- **Pixelmatch 7.1** - Image comparison for visual regression testing

### Development Environment
- **Node.js 18+** - Runtime environment for build tools
- **Modern Browsers** - Chrome, Firefox, Safari, Edge with WebGL support
- **VS Code** - Recommended editor with TypeScript and Three.js extensions

## 🚀 Quick Start

### Prerequisites
- **Node.js 18+** with npm
- **Modern web browser** with WebGL support

### Installation
```bash
# Clone the repository
git clone https://github.com/deadronos/SpaceAutoBattler.git
cd SpaceAutoBattler

# Install dependencies
npm install
```

### Development
```bash
# Start development server
npm run serve
# Open http://localhost:8080 in your browser
```

### Building
```bash
# Build standalone version
npm run build-standalone
# Output: dist/spaceautobattler_standalone.html
```

### Testing
```bash
# Run unit tests
npm test

# Run E2E tests
npm run test:e2e

# Type checking
npm run typecheck
```

## 🎮 Controls

### Camera Controls
- **Mouse Drag** - Rotate camera view
- **Mouse Wheel** - Zoom in/out (100-3000 units)
- **WASD** - Move camera target
- **Shift/Space** - Move camera up/down
- **C Key** - Cinematic camera reset (focus on ship cluster)

### Game Controls
- **▶ Start/Pause** - Control simulation
- **⏸ Reset** - Restart with new random seed
- **Speed Buttons** - Adjust simulation speed (0.5x to 4x)
- **Add Ship Buttons** - Spawn additional Red/Blue ships
- **Formation Button** - Rearrange fleets into formations

## 📊 Configuration

### Simulation Settings (`src/config/simConfig.ts`)
```typescript
boundaryBehavior: {
  ships: 'bounce' | 'wrap' | 'remove',
  bullets: 'bounce' | 'wrap' | 'remove'
}
tickRate: 60,           // Simulation updates per second
maxEntities: 1000,      // Entity limits
simBounds: {            // 3D battlefield dimensions
  width: 1920,
  height: 1920,
  depth: 1920
}
```

### Ship Classes (`src/config/entitiesConfig.ts`)
- **Fighter** - Fast, agile, low health
- **Corvette** - Balanced combat vessel
- **Frigate** - Heavy firepower platform
- **Destroyer** - Capital ship with advanced weapons
- **Carrier** - Fleet command ship with fighter production

### Visual Settings (`src/config/rendererConfig.ts`)
- Camera field of view and clipping planes
- Particle effects and shield visuals
- Health bar and UI configurations
- Performance and quality settings

## 🔬 Testing Strategy

### Unit Tests (`test/vitest/`)
- **Pure Logic Tests** - Simulation functions without rendering
- **Deterministic Scenarios** - Seeded RNG for reproducible results
- **Edge Case Coverage** - Boundary conditions and error states
- **Performance Benchmarks** - Simulation speed and memory usage

### E2E Tests (`test/playwright/`)
- **User Interaction** - Camera controls and UI functionality
- **Visual Regression** - Screenshot comparison for rendering consistency
- **Cross-browser** - Compatibility testing across different browsers

### Test Architecture
```
test/
├── vitest/           # Unit tests (simulation logic)
│   ├── simulationflow.spec.ts
│   ├── entities.spec.ts
│   └── utils/
├── playwright/       # E2E tests (full application)
│   ├── camera-controls.spec.ts
│   ├── ui-interaction.spec.ts
│   └── visual-regression.spec.ts
└── test-output/      # Test artifacts and screenshots
```

## 📈 Performance Characteristics

### Simulation Performance
- **60 FPS Simulation** - Fixed timestep ensures consistent gameplay
- **1000+ Entities** - Handles large fleet engagements
- **Deterministic** - No performance-dependent gameplay changes
- **Memory Efficient** - Object pooling and lifecycle management

### Rendering Performance
- **WebGL Optimized** - Instanced rendering for particle effects
- **LOD System** - Distance-based detail reduction
- **Batch Rendering** - Minimized draw calls
- **GPU Acceleration** - Hardware-accelerated 3D transformations

### Benchmarks
- **Simulation Step**: < 1ms for 100 ships + 500 bullets
- **Render Frame**: 60+ FPS on mid-range GPUs
- **Memory Usage**: ~50MB for typical gameplay sessions
- **Load Time**: < 2 seconds for initial page load

## 🤝 Contributing

### Development Workflow
1. **Fork and Clone** - Create your development branch
2. **Install Dependencies** - `npm install`
3. **Run Tests** - `npm test` (ensure all tests pass)
4. **Make Changes** - Follow the architectural patterns
5. **Test Thoroughly** - Both unit and E2E tests
6. **Submit PR** - Include test coverage and documentation

### Code Standards
- **TypeScript Strict** - No `any` types, full type coverage
- **Clean Architecture** - Maintain separation of concerns
- **Test-Driven** - Write tests before implementing features
- **Performance Conscious** - Profile and optimize critical paths
- **Documentation** - Update README and inline comments

### Architectural Guidelines
- **GameState First** - All state changes go through GameState
- **Pure Functions** - Simulation logic should be side-effect free
- **Interface Contracts** - Clear APIs between architectural layers
- **Configuration Driven** - Game balance through config files
- **Deterministic Design** - Reproducible behavior for testing

## 📄 License

**MIT License** - See [LICENSE.MD](LICENSE.MD) for details

## 🙏 Acknowledgments

- **Three.js Community** - Exceptional 3D web graphics library
- **TypeScript Team** - Industry-leading type system
- **Open Source Ecosystem** - Countless libraries and tools
- **Gaming Community** - Inspiration from classic space combat games

---

**SpaceAutoBattler** - Where strategy meets real-time 3D space combat ⚔️🚀✨