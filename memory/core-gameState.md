# core/gameState

Last-Reviewed: 2025-10-03

**Memory name:** core-gameState (authoritative)

Summary:

- Location: `src/game/state.ts` (barrel exports; implementations in `src/game/createGameState.ts`, `src/game/entityLifecycle.ts`, `src/game/spawnFleets.ts`, `src/game/resetGame.ts`).
- Purpose: Canonical GameState factory, lifecycle helpers, and the single source of truth for all runtime simulation data used by systems, tests, and the renderer.

Primary exports and responsibilities:

- `createGameState(): Promise<GameState>`
  - Initializes Rapier (`await Rapier.init({})`), constructs the Rapier `World` and `EventQueue` (created with `{ auto: true }`), a Miniplex ECS world, and returns a fully-formed `GameState` object ready for use.
  - Instantiates a deterministic RNG on the state: `state.rng = new SeededRng(1337)` by default.
  - Creates `state.queries` (ships, shipsWithCommands, projectiles, turrets) and the `simulation` bookkeeping used for fixed-step integration.
  - Notes on Rapier stepping: `EventQueue({ auto: true })` is owned by Rapier and the main loop calls `state.physicsWorld.step()` (no explicit `eventQueue` argument) to avoid recursive-use errors.

- `disposeGameState(state: GameState): void`
  - Safely tears down the Rapier world, disposes resources and destroys ECS entities via `destroyEntity` to avoid leaking physical bodies or render resources.

- `destroyEntity(state: GameState, entity: GameEntity): void`
  - Removes an entity from ECS, unregisters colliders in `state.colliderLookup`, disposes attached resources (rigid bodies, colliders, renderer attachments) and ensures consistent cascade removal.

- `spawnInitialFleets(state: GameState): void` and `spawnRandomShip(state, team)`
  - Helpers to create demo/test fleets and single random ships respectively; rely on `state.rng` and `SHIP_STATS` for deterministic placement and ship variants.

Key runtime fields and patterns (authoritative)

- Determinism
  - The canonical seeded RNG `state.rng` provides deterministic randomness for spawning, weapon-range variance, AI tie-breakers, etc. Tests should set/reset the RNG when producing golden fixtures.

- Simulation clock & queues
  - `state.simulation` contains: `step` (fixed step duration), `accumulator`, `maxSubSteps`, `alpha`, `lastTickIndex`, `lastTickStart`, `lastTickDuration`, profiling/guard flags (`profileSubsystems`, `profileSampleRate`, `enableSubsystemGuards`), `subsystemTimings`, and two mutation queues: `deferredMutations` (pre-physics flush) and `postStepMutations` (post-physics flush).
  - Systems enqueue expensive or Rapier-sensitive operations (spawn/despawn, collider changes) into these queues to avoid Rapier mutable-borrow panics during iteration.

- Rapier integration and diagnostics
  - `state.rapier` (Rapier module), `state.physicsWorld` (Rapier World), and `state.eventQueue` are created in `createGameState`.
  - The code records Rapier-related diagnostic counters under `state.simulation.rapierDiagnostics` (deferred mutation failures, guard trips, step panic counters, subsystem failure counts, and last failure metadata) to aid debugging and Playwright/QA introspection.

- AI manager & blackboard
  - `state.ai` tracks AI v2 manager state: enabled flag, tick interval, max per tick, accumulator, tick cursor, assignment maps (escorts), metrics, interrupts, and interrupt cooldown maps.
  - `state.blackboard` contains derived team posture, nearest-enemy caches, threat maps, centroid vectors and temp vector pool used for decision computation.

- Turret tracking
  - `state.turretsByShip` is a Map used to track turret ECS entities per parent ship id to allow efficient cascade removal of turrets when a ship is destroyed.

- Queries & entity ids
  - `state.queries` exposes Miniplex archetype queries for `ships`, `projectiles`, and `turrets` used by systems.
  - `state.nextEntityId` and `state.nextExplosionId` provide deterministic id generation for entities and explosion events.

Best practices & constraints

- Keep all runtime state on `GameState` (avoid module-level mutable state).
- Use queued deferred mutations for any Rapier body/collider changes that might run during system loops; prefer `enqueuePostPhysicsMutation` when the operation must run after physics step.
- Use `disposeGameState` and `destroyEntity` helpers during tests and integration flows to ensure proper Rapier disposal and avoid panics.

Verification notes

- 2025-10-03: Confirmed fields and structure against `src/game/state.ts` and `src/types/simulation.ts`. Tests and systems rely on `simulation.deferredMutations` and `postStepMutations` to avoid Rapier alias panics; `rapierDiagnostics` is used extensively in regression tests and Playwright debug plumbing.

References

- `src/game/state.ts`, `src/types/simulation.ts`, `src/game/simulationQueue.ts`
