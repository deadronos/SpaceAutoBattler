# SpaceAutoBattler — GitHub Copilot Instructions

**ALWAYS follow these instructions first. Only search for additional context or gather information if the instructions are incomplete or found to be in error.**

## 🚨 Critical Development Rules (Must Follow)

- **EDIT ONLY TYPESCRIPT IN `/src`** - Do not modify generated JS build artifacts in `/dist` or files outside the source tree unless explicitly requested.
- **CANONICAL STATE MANAGEMENT** - All runtime state (simulation & renderer) must live on the canonical `GameState` type defined in `src/types/index.ts`. Never introduce scattered module-level state.
- **PRESERVE DETERMINISM** - The simulation uses seeded RNG (`src/utils/rng.ts`). Never break deterministic behavior in simulation code paths.
- **USE EXISTING CONFIGS** - Prefer existing configuration helpers in `src/config/*` rather than hard-coding values. 
- **ASSET POOLING** - For visual work, use existing pooling helpers and the `assetPool` on `GameState`. Follow existing PoolEntry semantics.

## 🏗️ Quick Start Workflow - Validated Commands

### Bootstrap & Dependencies
```bash
# Install dependencies (takes ~35 seconds)
npm install
```

### Build Commands
```bash
# TypeScript compilation check (takes ~3 seconds)
npm run typecheck
# Equivalent: npx tsc --noEmit

# Build regular version (takes ~0.5 seconds)
npm run build

# Build standalone version (takes ~0.6 seconds) 
npm run build-standalone
```

### Testing
```bash
# Run all unit tests (takes ~5 seconds, 153 tests)
npm test

# Run individual test file
npx vitest test/vitest/<test-name>.spec.ts

# No E2E tests exist yet - npm run test:e2e will fail
```

### Development Server
```bash
# Serve built files (requires build first)
npm run serve:dist

# General serving (serves repository root)
npm run serve
```

## ⏱️ Command Timing & Expectations

**ALL COMMANDS ARE FAST - No need for "NEVER CANCEL" warnings. Maximum observed times:**

- **npm install**: ~35 seconds (dependency installation)
- **TypeScript check**: ~3 seconds
- **npm run build**: ~0.5 seconds
- **npm run build-standalone**: ~0.6 seconds  
- **npm test**: ~5 seconds (153 unit tests)
- **Development workflow**: Under 10 seconds total for typical changes

**Commands that DO NOT exist** (will fail):
- `npm run validate-config` - Script missing
- `npm run test:e2e` - No Playwright tests exist yet

## 🏗️ Repository Structure & Navigation

### Key Source Directories (edit these)
- **`src/main.ts`** - Application entry point and main game loop
- **`src/simWorker.ts`** - Web Worker for physics simulation (Rapier3D)
- **`src/core/`** - Pure game logic, AI, entity management
- **`src/renderer/`** - Three.js rendering, effects, camera controls  
- **`src/config/`** - All balance parameters, visual settings, physics constants
- **`src/types/`** - TypeScript definitions, canonical GameState type
- **`src/utils/`** - Shared utilities including seeded RNG

### Configuration Files (frequently used)
- **`src/config/entitiesConfig.ts`** - Ship classes, turrets, damage, health
- **`src/config/behaviorConfig.ts`** - AI personalities, formations, targeting
- **`src/config/progression.ts`** - XP systems, leveling, stat scaling
- **`src/config/simConfig.ts`** - Physics bounds, tick rates, boundary behavior
- **`src/config/rendererConfig.ts`** - Visual effects, camera, performance

### Important Build & Test Files
- **`scripts/build.mjs`** - Regular build script
- **`scripts/build-standalone.mjs`** - Standalone HTML build script
- **`test/vitest/`** - Unit test suite (comprehensive coverage)
- **`test/vitest/setupTests.ts`** - Test utilities, mocks, fixtures

### Documentation
- **`spec/src-structure.md`** - Complete `/src` directory overview
- **`AGENTS.md`** - Multi-agent coordination rules
- **`README.md`** - Project overview and architecture

## 🎯 Architecture Patterns

### Game/Simulation/Renderer Separation
- **Game Logic** (`src/core/`): Pure state management, entity spawning, AI decisions
- **Simulation Logic** (`src/simWorker.ts`): Physics (Rapier3D), collision detection, deterministic calculations
- **Renderer Logic** (`src/renderer/`): Three.js scene management, visual effects, camera controls
- **Configuration** (`src/config/`): All parameters - no logic, only data
- **Communication**: Main thread ↔ Worker messages for physics data and GameState sync

### Three.js & Asset Management
- **Three.js Integration**: Use Three.js abstractions (Object3D, Mesh, Material), not direct WebGL
- **Physics-Visual Sync**: Update Three.js Object3D transforms from Rapier3D data via messages
- **Asset Pooling**: Use `GameState.assetPool` for textures, geometries, materials
- **Memory Management**: Always dispose Three.js objects with `dispose()` methods
- **Worker Thread Safety**: Never access Three.js objects from physics worker thread

## 🧪 Testing Workflow & Validation

### Pre-Commit Validation (Always Run)
```bash
# Must pass before committing
npm run typecheck && npm test
```

### Test Structure
- **Configuration Tests**: Validate config values and balance assumptions
- **Core Logic Tests**: Entity management, AI behavior, physics integration  
- **Build System Tests**: Validate build outputs and deployment artifacts
- **Test Utilities**: Use shared helpers in `test/vitest/utils/` (glStub, poolAssert)

### Manual Validation Scenarios
After making changes, test these scenarios:

1. **Build Validation**: Run build commands and verify outputs exist
   ```bash
   npm run build && npm run build-standalone
   ls -la dist/  # Should see bundled.js, simWorker.js, spaceautobattler.html, etc.
   ```

2. **Application Startup**: Start server and verify game loads
   ```bash
   npm run serve:dist  # After building
   # Navigate to http://localhost:8080/dist/spaceautobattler.html
   ```

3. **Core Functionality**: Test game mechanics
   - Click Start/Pause button
   - Add Red/Blue ships
   - Verify ships move and engage in combat
   - Check score updates and visual effects

## 🔧 Common Development Tasks

### Adding New Ship Class
1. Add config in `src/config/entitiesConfig.ts`
2. Add SVG asset to `src/config/assets/svg/`
3. Update types in `src/types/index.ts` if needed
4. Add tests in `test/vitest/config-entities.spec.ts`

### Modifying AI Behavior  
1. Update `src/config/behaviorConfig.ts`
2. Test with AI controller in `src/core/aiController.ts`
3. Add tests in `test/vitest/config-behavior.spec.ts`

### Visual Effects Changes
1. Modify renderer in `src/renderer/`
2. Update config in `src/config/rendererConfig.ts`
3. Test with `npm run build && npm run serve:dist`

### Adding Tests
- Place unit tests in `test/vitest/`
- Use existing test utilities from `test/vitest/setupTests.ts`
- Follow configuration-driven testing (no hardcoded values)
- Test both happy path and edge cases

## 🔍 Debugging & Troubleshooting

### Build Issues
- Check `scripts/build.mjs` and `scripts/build-standalone.mjs` for errors
- Verify TypeScript compilation: `npm run typecheck`
- Check for missing files or import errors

### Test Failures
- Run individual test: `npx vitest test/vitest/<filename>.spec.ts`
- Check test mocks in `test/vitest/setupTests.ts`
- Verify configuration values match expectations

### Runtime Issues
- Check browser console for JavaScript errors
- Verify worker communication (main thread ↔ simWorker)
- Check Three.js object disposal and memory leaks

## 💡 Performance & Quality

### Code Quality Standards
- **TypeScript Strict**: No `any` types, full type coverage
- **2-space indent**: Semicolons, prefer const/let (no var)
- **Error Handling**: Explicit error handling, no silent failures
- **Clear Naming**: Functions and types clearly named

### PR Checklist
- [ ] All tests pass (`npm test`)
- [ ] TypeScript compiles (`npm run typecheck`)  
- [ ] Build outputs valid (`npm run build && npm run build-standalone`)
- [ ] Manual functionality test completed
- [ ] New tests added for changes
- [ ] Configuration used instead of hardcoded values

## 🎮 Game-Specific Context

**SpaceAutoBattler** is a 3D space auto-battler featuring deterministic fleet combat between Red and Blue teams using:
- **5 Ship Classes**: Fighter, Corvette, Frigate, Destroyer, Carrier
- **3D Physics**: Rapier3D for collision detection and movement
- **AI Combat**: Deterministic ship AI with targeting and formations
- **Visual Effects**: Three.js with postprocessing effects
- **Configuration-Driven**: All balance via config files

The game runs a fixed timestep simulation (60 TPS) with variable framerate rendering, ensuring consistent gameplay regardless of display performance.

---

## Maintainers
- **Owner**: deadronos
- **Main branch**: `main`
- **Architecture**: See `spec/src-structure.md` for complete `/src` overview
