<!--
SpaceAutoBattler — Copilot Quick Reference

This file tells the coding agent how to make safe, small, test-backed changes in the repository. Keep edits minimal, test-driven, and localized to TypeScript source in `/src` unless the task explicitly requires otherwise.

For a complete overview of the `/src` directory structure and module organization, see `spec/src-structure.md`.
-->

# SpaceAutoBattler — Copilot Quick Reference

## Key rules (must follow)

- Edit only TypeScript files under `src/`. Do not modify generated JS build artifacts or files outside the source tree unless the user asks and gives explicit permission.
- All runtime state (simulation & renderer) must live on the canonical `GameState` type defined in `src/types/index.ts`. Do not introduce scattered module-level state.
- For any asset/visual work prefer the existing pooling helpers and the `assetPool` on `GameState` (textures/sprites/effects). Follow existing PoolEntry semantics when available.
- Use existing configuration helpers (for example `config/*`) rather than hard-coding values. Prefer renderer config values for layout and scale.
- Preserve determinism: the simulation uses seeded RNG (`src/utils/rng.ts`) — don't break deterministic behavior in simulation code paths.

## Workflow & safety checklist

Agents must also follow multi-agent coordination rules when present in the repository (see `AGENTS.md` and optional `agent-config.json`). Before editing files agents MUST check for `.ai-lock.json` lockfiles and behave as described below.

1. Plan the smallest change that solves the user's request.
2. Update or add TypeScript in `src/` only; keep the change minimal and well-scoped.
3. Add or update unit tests under `test/vitest/` for the change (happy path + 1-2 edge cases). Use the shared test helpers in `test/vitest/utils/` (e.g., `glStub`, `poolAssert`) where relevant.
4. Run the local checks:

```powershell
npx tsc --noEmit
npm test
```

5. Fix any TypeScript errors or failing tests before committing.
6. Update implementation status and documentation as needed.

## Pooling & renderer guidance

- **Three.js Integration**: Use Three.js abstractions (Object3D, Mesh, Material) rather than direct WebGL calls. Always dispose of Three.js objects properly using `dispose()` methods.
- **Rapier3D Physics**: Physics bodies and colliders should be managed separately from visual representations. Use physics simulation in Web Worker for performance.
- **Postprocessing**: Apply postprocessing effects (bloom, tone mapping, etc.) through Three.js EffectComposer. Configure effects in renderer config, not hardcoded.
- **Asset Management**: Use `GameState.assetPool` for Three.js textures, geometries, and materials. Implement proper cleanup with `texture.dispose()`, `geometry.dispose()`, `material.dispose()`.
- **Renderer-Physics Separation**:
  - Simulation Worker: Handles Rapier3D physics world, collision detection, rigid body updates
  - Main Thread: Updates Three.js Object3D transforms from physics data, manages rendering
  - Never access Three.js objects from physics worker thread
- **Pooling Strategy**:
  - Pool Three.js Meshes and Materials for frequently created/destroyed objects (bullets, particles, effects)
  - Use Object3D pooling for complex hierarchies
  - Implement pool warming for critical assets to avoid frame drops
  - Clean up unused pools during level transitions

## Game/Simulation/Renderer Logic Separation

- **Game Logic** (`src/core/`): Pure game state management, entity spawning, AI decision-making, XP/leveling systems
- **Simulation Logic** (`src/simWorker.ts`): Physics simulation (Rapier3D), collision detection, deterministic calculations using seeded RNG
- **Renderer Logic** (`src/renderer/`): Three.js scene management, visual effects, postprocessing, camera controls
- **Configuration** (`src/config/`): All balance parameters, visual settings, physics constants - no logic, only data
- **Communication Pattern**: Main thread ↔ Worker messages for physics data, GameState synchronization, render updates
- **Determinism**: Keep all random calculations in simulation worker using seeded RNG for replay capability
- **Performance**: Isolate heavy physics calculations in worker thread, keep rendering optimizations on main thread

## Tests & fixtures

- Shared test helpers live under `test/vitest/utils/` (e.g., `glStub.ts`, `poolAssert.ts`). Use them to write deterministic tests for pooling behaviors and GL-related logic.
- Add a small GL stub in tests to assert `createTexture` / `deleteTexture` call counts instead of calling a real WebGL context.

## PR & commit guidance

- Keep commits small and focused. Each PR should implement one measurable change (API + tests + docs if needed).
- PR description template:

1. Goal: one-line summary.
2. Files changed: list key files.
3. Tests: list tests added or updated and how to run them.
4. Validation: `npx tsc --noEmit` and `npm test` output summary (pass/fail).

---

## Maintainers

- Owner: deadronos
- Main branch: `main`
- Project Structure: See `spec/src-structure.md` for complete `/src` directory overview
