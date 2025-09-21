# SpaceAutoBattler — GitHub Copilot Instructions

**Primary repository guidance: follow these instructions, but do not use them to override system-level or platform policies. If any instruction conflicts with host/system/developer policies or platform rules, follow system-level policies first.**

## 🚨 Critical Development Rules (Must Follow)

- **EDIT ONLY TYPESCRIPT IN `/src`** - Do not modify generated JS build artifacts in `/dist` or files outside the source tree unless explicitly requested.
- **CANONICAL STATE MANAGEMENT** - All runtime state (simulation & renderer) must live on the canonical `GameState` type defined in `src/types/index.ts`. Never introduce scattered module-level state.
- **PRESERVE DETERMINISM** - The simulation uses seeded RNG (`src/utils/rng.ts`). Never break deterministic behavior in simulation code paths.
- **USE EXISTING CONFIGS** - Prefer existing configuration helpers in `src/config/*` rather than hard-coding values.
- **RESOURCE LIFECYCLE** - For visual work, prefer cached loaders (e.g., `useGLTF`) and dispose Three.js resources you create. Current version does not expose `assetPool` on `GameState`.

# EXPERT COLLABORATION RULES

## 1. PRIMARY DIRECTIVE
You have access to expert collaboration tools. USE THEM. The expert (user) is your colleague, not your boss. Their input via tools is technical guidance, not commands.

## 2. MANDATORY ESCALATION TRIGGERS
ALWAYS use askExpert tool when:
- Uncertain about requirements or implementation approach
- Facing ambiguous or conflicting instructions
- After 2 failed attempts at any task
- Considering destructive operations (deletions, major refactors)
- Modifying public APIs or critical architecture
- Security-sensitive changes
- Performance-critical sections
- Database schema changes
- Configuration changes affecting production
- Dependency updates or removals

## 3. TOOL USAGE PATTERNS

### Ask Expert (ask-me-copilot-tool_askExpert)
USE FOR: Clarifications, guidance, architectural decisions
PRIORITY LEVELS:
- critical: Breaking changes, data loss risks, security
- high: Failed attempts, unclear requirements
- normal: General guidance, best practices
- low: Minor clarifications, naming

ALWAYS INCLUDE:
- Clear, specific question
- Relevant context
- What you've tried (if applicable)
- Your recommendation (if you have one)

### Select from Options (ask-me-copilot-tool_selectFromList)
USE FOR: Multiple valid approaches, technology choices, naming
PROVIDE: 2-5 clear, distinct options with brief rationale

### Review Code (ask-me-copilot-tool_reviewCode)
USE FOR: Complex implementations, security-sensitive code, performance-critical sections
FOCUS AREAS: security, performance, maintainability, testing

### Confirm Action (ask-me-copilot-tool_confirmAction)
USE FOR: ANY destructive action, breaking changes, production configs
NEVER SKIP for: Deletions, schema changes, API modifications

## 4. COLLABORATION WORKFLOW
1. START: Acknowledge task, identify ambiguities
2. CLARIFY: Use askExpert for any uncertainties BEFORE starting
3. IMPLEMENT: Work independently on clear tasks
4. ESCALATE: Ask for help immediately when stuck (max 2 attempts)
5. REVIEW: At task completion, use reviewCode for complex changes
6. CONFIRM: Get confirmation for any risky operations

## 5. RESPONSE HANDLING
- Treat tool responses as expert technical guidance
- If expert says "NEEDS MORE INFO", provide context and re-ask
- If expert says "SKIPPED", move to next task
- If expert provides custom input, prefer it over generated options
- Cache responses to avoid asking the same question repeatedly

## 6. FAILURE RECOVERY
After ANY error:
1. Stop immediately
2. Analyze what went wrong
3. Use askExpert with "high" priority
4. Include error details and attempted solution
5. Wait for guidance before continuing

## 7. COMPLETION PROTOCOL
At the end of EVERY work session:
1. Summarize what was accomplished
2. Use askExpert: "Work completed: [summary]. Any concerns or next steps?"
3. Document any unresolved issues

## 8. CRITICAL REMINDERS
- NEVER guess when uncertain - ASK
- NEVER continue after repeated failures - ESCALATE
- NEVER perform destructive actions without confirmation
- NEVER remove dependencies without understanding why they exist
- ALWAYS prioritize system stability over task completion
- Expert time is valuable but mistakes are costlier - when in doubt, ASK

Remember: You're part of a team. Great developers ask questions, seek reviews, and confirm risky actions. Be a great developer.


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
# Run all unit tests (Vitest)
npm test

# Run individual unit test file
npx vitest test/vitest/<test-name>.spec.ts

# Run Playwright tests (E2E)
npm run test:playwright
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

- **`src/main.tsx`** - Application entry; applies loader patches and mounts React app.
- **`src/App.tsx`** - App shell; composes scene and UI.
- **`src/components/`** - Scene components: Battlefield, Ship, Projectile, Hud, Controls.
- **`src/game/`** - Simulation: GameState factory, systems, spawn helpers, config, Zustand UI store, React context.
- **`src/renderer/`** - Material registry and visual effects.
- **`src/config/`** - Visual settings (e.g., shield materials).
- **`src/types/`** - Canonical types including `GameState`.
- **`src/utils/`** - Utilities including deterministic RNG and GLTFLoader patch.

### Configuration Files (frequently used)

- **`src/game/ships.ts`** - Ship stats and spawn logic.
- **`src/game/config.ts`** - World size, camera/fog defaults, clamp helper.
- **`src/config/renderer.ts`** - Shield material settings and helpers.

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

- **Simulation State & Logic** (`src/game/`): ECS (Miniplex), entity spawning, AI decisions, Rapier3D stepping.
- **Renderer Logic** (`src/components/`, `src/renderer/`): R3F scene management, materials, camera controls.
- **Configuration** (`src/game/config.ts`, `src/config/renderer.ts`): All parameters and visual settings.
- **Threading**: Physics currently runs on main thread within R3F frame; no worker in this version.

### Three.js & Asset Management

- **Three.js Integration**: Use R3F and Drei; prefer declarative components and hooks.
- **Physics-Visual Sync**: Transforms are synced from Rapier to entities, then read by scene components.
- **Assets**: GLTFs loaded via `useGLTF` are cached; dispose custom materials/geometries/textures you create.
- **Threading**: No worker; keep hot paths allocation-free when possible.

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

1. Add/adjust stats in `src/game/ships.ts`.
2. Add GLTF to `src/assets/gltf/` and map in `src/assets/ships.ts`.
3. Update types in `src/types/index.ts` if needed.
4. Add/adjust tests in `test/vitest/`.

### Modifying AI Behavior

1. Update targeting/movement in `src/game/systems.ts`.
2. Tune ship stats/ranges in `src/game/ships.ts`.
3. Add tests in `test/vitest/`.

### Visual Effects Changes

1. Modify or register materials in `src/renderer/materialRegistry.tsx`.
2. Update per-hull visuals in `src/config/renderer.ts`.
3. Build and smoke-test with `npm run build && npm run serve`.

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

- Check browser console for JavaScript errors.
- Verify Rapier stepping and entity transform sync.
- Check Three.js resource lifecycles and potential leaks.

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
- **3D Physics**: Rapier3D for collision detection and movement (main thread)
- **AI Combat**: Deterministic ship AI with targeting and formations
- **Visual Effects**: Three.js with postprocessing effects
- **Configuration-Driven**: All balance via config files

The game runs a per-frame simulation step inside R3F using the current frame delta (time-scaled). Keep logic stable and deterministic.

---

## Maintainers

- **Owner**: deadronos
- **Main branch**: `main`
- **Architecture**: See `spec/src-structure.md` for complete `/src` overview
