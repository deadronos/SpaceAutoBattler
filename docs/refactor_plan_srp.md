# Refactor Plan: Enforce Single Responsibility Principle (SRP)

Target files:
- `src/core/aiController.ts` (600+ LOC)
- `src/renderer/threeRenderer.ts` (800+ LOC)
- `src/core/gameState.ts` (400+ LOC)

Goal: Reduce coupling and responsibilities, make modules easier to test, maintain, and reason about by incremental, low-risk refactors. No source code edits will be performed as part of this analysis — this document defines the plan, module boundaries, tests, and risk/rollback strategy.

---

## 1) High-level responsibilities (what each file currently does)

### aiController.ts
- Intent evaluation & selection (pursue, evade, strafe, group, patrol, explore, retreat)
- Execution of behavior primitives (pursue logic, strafe, formation, evasion maneuvers)
- Team-level logic (alarms, scout assignments, formation finding)
- Per-ship AI state management, cached separation computations, and spatial-grid queries
- Turret targeting updates, shield/health hooks, recent damage tracking
- Mix of pure logic (score calculations, selection heuristics) and side-effects (mutating ship state, assigning targets)

### threeRenderer.ts
- Scene initialization and cleanup (THREE.Scene, lights, skybox)
- Camera management and controls
- Mesh creation and pooling for ships, bullets, and other entities
- Shader management (inline GLSL) and complex shield effects
- Per-frame synchronization (mapping GameState -> Three.js entities)
- UI overlays (health bars) and post-processing
- Runtime animations and effects (particles, shield pulses)

### gameState.ts
- GameState lifecycle (create/reset)
- Entity creation (spawnShip, spawnFleet)
- Simulation step orchestration (simulateStep): calls AI, spatial grid updates, turrets, bullets, deaths/XP, level ups, carriers, cleanup
- Bullet integration & collision handling (damage/shield/XP)
- Boundary behavior (wrap, bounce, prune, teleport)
- Progression and carrier spawn logic

---

## 2) Guiding principles for the refactor
- Make no functional changes before coverage tests exist (characterization tests).
- Prioritize extracting pure functions and stateless helpers first (lowest risk). Use tests to validate each extraction.
- Create well-defined interfaces for stateful subsystems (e.g., PhysicsStepper, SpatialIndex, AIIntentManager, RendererMeshFactory). Inject dependencies rather than import directly to enable mocking for tests.
- Keep commit boundaries small and atomic: each commit should either add tests, add an adapter, or move a single responsibility.
- Preserve existing public module exports and runtime behavior during migration. Introduce adapters that delegate to old code until the new module is fully wired.

---

## 3) Suggested module decomposition (per file)

### aiController.ts -> candidate modules
1. AI/Decision Engine (pure): intent scoring functions, heuristics, threat/escape scoring.
   - New file: `src/core/ai/decisionEngine.ts`
   - Exports pure functions: scorePursue(), scoreEvade(), scoreRoam(), chooseBestIntent(...)
   - Tests: unit tests covering scoring outputs, edge cases for tie-breaking.

2. Intent Manager (stateful): manages per-ship AI state, intent lifetimes, re-evaluation scheduling.
   - New file: `src/core/ai/intentManager.ts`
   - API: class IntentManager { getIntent(ship), setIntent(ship, intent), tick(dt) }
   - It depends on decisionEngine for scoring; owns caching and timers.

3. Movement Planner / Steering (pure-ish): vector math, separation, formation slot assignment.
   - New file: `src/core/ai/steering.ts`
   - Exports functions: calculateSeparationForceWithCount, moveTowards, clampTurn, calculateEscapeScore
   - Tests: deterministic vector outputs given seed/state.

4. Tactical Executors (mutating): small adaptors that apply movement or actions onto ship state (e.g., executePursue, executeEvade).
   - New file: `src/core/ai/executors.ts`
   - These will accept state and ship and mutate ship accordingly.

5. Team / Tactical Coordinator (stateful): alarms, scout assignments, team-wide decision utilities.
   - New file: `src/core/ai/teamCoordinator.ts`
   - API: updateTeamAlarms(), assignScouts(), findBestFormation()

6. AIController facade (thin): existing `AIController` class becomes a small orchestrator that uses the above modules.
   - Keep `src/core/aiController.ts` but shrink to orchestrator-level logic calling newly extracted modules. Existing code continues to work; tests ensure parity.

Reason: This breakdown separates pure reasoning (easy to test) from stateful orchestration and side effects.


### threeRenderer.ts -> candidate modules
1. Scene setup & lifecycle
   - `src/renderer/sceneSetup.ts`: createScene(), disposeScene(), setupLights(), setupSkybox()
2. Camera manager
   - `src/renderer/cameraManager.ts`: camera creation, resizing behavior, control wiring
3. Mesh factory & pooling
   - `src/renderer/meshFactory.ts`: functions to create ship/bullet meshes and a pooling mechanism
4. Effects & shaders
   - `src/renderer/effects/shieldEffect.ts` (GLSL moved to `shaders/shield.glsl`), `src/renderer/effects/postprocessing.ts`
5. Synchronizer (GameState -> scene)
   - `src/renderer/synchronizer.ts`: incremental entity sync, minimal diffs, map GameState ids -> meshes
6. UI overlays and HUD
   - `src/renderer/overlay.ts`: health bars and screen-space overlays
7. Renderer facade (thin): `threeRenderer.ts` reduced to instantiation and lifecycle wiring calling the above modules

Reason: GPU/shader code and DOM/UI overlays have different testing and deployment considerations. Extract shaders as text files for easier editing and unit-testing (string snapshots). Mesh creation and pooling are pure enough to unit test (counts, reuse); rendering visual parity can be smoke-tested via headless e2e or snapshot images.


### gameState.ts -> candidate modules
1. Lifecycle & state factory
   - `src/core/stateFactory.ts`: createInitialState(), resetState()
2. Spawn manager
   - `src/core/spawnManager.ts`: spawnShip(), spawnFleet(), randomSpawnPos()
3. Bullet manager
   - `src/core/bulletManager.ts`: updateBullets(), bullet creation, TTL, removal
4. Collision & damage system
   - `src/core/collisionManager.ts`: collision detection, shield/health/armor interactions, XP attribution
5. Progression manager
   - `src/core/progressionManager.ts`: handleLevelUps(), xp/kill tracking
6. Carrier manager
   - `src/core/carrierManager.ts`: carrierSpawnLogic(), spawnedFighters accounting
7. Boundary manager
   - `src/core/boundaryManager.ts`: applyBoundaryPhysics(), runBoundaryCleanup()
8. Simulation orchestrator (simulateStep)
   - `src/core/simulate.ts`: small orchestrator that calls AIController, spatial update, managers' tick methods in the existing order

Reason: This decomposes by responsibility and preserves the simulation tick order by keeping a central orchestrator. Each manager can be unit tested in isolation; collision logic and bullet effects are high-risk and should get broad coverage before refactor.

---

## 4) Critical cross-cutting dependencies & adapters
- SpatialGrid usage: multiple subsystems rely on `state.spatialGrid`. Introduce a small `SpatialIndex` interface in `src/core/spatialIndex.ts` that wraps the existing `SpatialGrid` methods (`insert`, `update`, `queryKNearest`, `forEachInRadius`, `gcExcept`, `clear`) and adapt calls to use the interface. This allows tests to swap in-memory stub implementations.

- Physics: `physics.ts` already exposes a `PhysicsStepper`. Game logic should call into a small `PhysicsAdapter` that proxies to the physics stepper when enabled.

- Renderer: `threeRenderer` should expose a `RendererAdapter` with methods like `ensureMeshForShip(ship)`, `updateMeshFromShip(ship)`, `removeMesh(id)`. This allows unit tests to replace the renderer with a no-op adapter.

- RNG: `state.rng` already exists; ensure all new modules accept `rng` via `state` to preserve determinism.

---

## 5) Characterization tests to write first (high-priority)
Write tests before code moves to pin current behavior.

A. GameState tests (high risk)
- Spawn & id allocation: seed the RNG and assert spawnShip produces deterministic positions and ids.
- Bullet collision: create two ships, spawn a bullet that hits, assert shield/health reduction and XP assigned to the owner.
- Carrier spawn: ensure carrier spawns fighters with correct cooldown and parent tracking.
- Boundary cleanup: place ship outside bounds, run `runBoundaryCleanup()`, assert position reset and velocity zero.

B. AI tests (medium risk)
- Decision engine unit tests: give deterministic inputs and assert best intent selected.
- calculateSeparationForceWithCount tests with small groups; assert magnitude/direction.
- Intent lifecycle: create ship with an existing intent and ensure reevaluation timing behaves as expected.

C. Renderer tests (low-to-medium risk)
- Mesh factory tests: create/destroy a mesh and ensure pooling reuses objects.
- Shader string snapshots: ensure GLSL moved into file is unchanged.
- Synchronizer tests (headless): with a mocked `RendererAdapter`, feed a small GameState and assert correct adapter calls (create/update/remove counts).

D. Integration smoke tests
- simulateStep for N small ticks with deterministic seed; assert invariants (no NaNs, id uniqueness, stable shipIndex size, bullets array counts consistent)

---

## 6) Extraction strategy and commit boundaries (suggested)
Phase A — Preparation (small commits)
1. Add tests (characterization) that pin current behavior — commit.
2. Add adapter interfaces (SpatialIndex, RendererAdapter, PhysicsAdapter) and small no-op implementations that wrap existing concrete implementations. Import only where needed. Commit.

Phase B — Pure logic extraction
3. Extract pure functions (decisionEngine, steering helpers) into new modules and update imports in `aiController.ts` to call them. Keep behavior identical. Run tests. Commit.

Phase C — Stateful extraction behind adapters
4. Introduce IntentManager class and wire it behind an adapter; make AIController use the adapter. Tests. Commit.
5. Extract spawnManager & bulletManager with retained function bodies; update `gameState.ts` to call them. Tests. Commit.

Phase D — Renderer split
6. Extract meshFactory and synchronizer behind RendererAdapter (no behavior change). Tests (adapter mocked). Commit.

Phase E — Replace facades with final modules
7. Remove old monolithic code and make orchestrator/AIController delegate to new modules. Run full tests and run smoke manual visual checks. Commit.

Each commit must be small, run tests, and be reversible.

---

## 7) Risk matrix & rollback plan
- High risk: collision/damage logic, XP/kill crediting, simulateStep ordering. Mitigation: add many characterization tests, run full test suite and small deterministic simulations.
- Medium risk: AI timing and intent switching, influences on combat decisions. Mitigation: extract decision logic first and add unit tests for scoring.
- Low risk: renderer visual details (GLSL). Mitigation: move shaders as text and keep original shader source for comparison; provide a visual smoke test.

Rollback plan:
- Keep branches per phase; if regression detected, revert the last phase branch and bisect commits.
- For each adapter, keep old implementation in place until new module has passing tests and manual smoke check.

---

## 8) PR & review guidance
- Create small PRs per phase (A–E). Each PR must include:
  - A short description of exact files changed and why
  - Tests added/updated and their purpose
  - How to run a visual smoke test (if rendering change)
  - Known risks and how they were mitigated

- Use reviewers familiar with simulation determinism and rendering.

---

## 9) Estimated timeline (rough)
- Phase A (tests + adapters): 1 day
- Phase B (pure logic extraction): 1–2 days
- Phase C (stateful extraction): 2–3 days
- Phase D (renderer split & shaders): 2–3 days + visual QA
- Phase E (final cleanup): 1–2 days

Total: ~7–11 work days depending on review cycles and visual QA.

---

## 10) Appendices
- Suggested filenames and prototypes (interfaces) for adapters
- List of characterizing test names to add
- Example commit messages for each change type

(If you want, I can now create the characterization tests and adapter interface files as a next step. No production code will be modified until tests and adapters are in place.)
