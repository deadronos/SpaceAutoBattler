# Memory — core-gameState

File: `src/game/state.ts`

Responsibilities (summary)

- `createGameState()` initializes Rapier, the physics `World`/`EventQueue`, the Miniplex ECS world, a seeded RNG, and wires the AI manager (`state.ai`) plus the AI blackboard scaffolding.
- The factory also creates optional runtime registries used by the engine such as `turretsByShip` and pre-populates archetype queries used by systems (`ships`, `projectiles`, `turrets`).
- Lifecycle helpers `destroyEntity(state, entity)` / `disposeGameState(state)` manage Rapier resources, ECS cleanup, turret cascade removal (using the `turretsByShip` registry and `registerTurret`/`unregisterTurret` helpers), and free Rapier objects and the EventQueue when tearing down the entire state.
- A safe reset path exists: `requestReset(state)` schedules a full `resetGame` to run after the current physics step via `SimulationClock.pendingReset` to avoid Rapier aliasing/console errors.

Key data and structures

- `GameState` carries the canonical runtime pieces required by systems:
  - Rapier runtime module and instances (`rapier`, `physicsWorld`, `eventQueue`).
  - ECS world and archetype queries (`world`, `queries`) plus `colliderLookup` for fast collider -> entity resolution.
  - Entity id counters (`nextEntityId`, `nextExplosionId`) and pooled renderer/event structures (`explosions`, `explosionPool`).
  - Simulation bookkeeping under `simulation: SimulationClock` including `step`, `accumulator`, `maxSubSteps`, `alpha`, `lastTickIndex`, `lastTickStart`, `lastTickDuration`, and the optional `pendingReset?: (() => void) | null` closure used by `requestReset`.
  - Deterministic `rng` instance (SeededRng) used for any simulation randomness.
  - `ai: AIManagerState` and `blackboard: AIBlackboard` used by the decision systems. The AI state includes scheduling knobs (tickInterval, maxPerTick, slices), assignments (escorts map), metrics, and interrupt bookkeeping (`interrupts`, `interruptState`) used by intent interruption and metrics diagnostics.
  - `turretsByShip?: Map<number, Set<TurretEntity>>` optional registry created at runtime to enable O(1) turret cascade removal on ship destruction.
  - `uiFlags` and renderer-facing state (e.g., `progressionEvents` map) mirrored from UI store for deterministic replays.

Behavior notes

- `createGameState` intentionally provides small backwards-compatibility shims for older Miniplex APIs (e.g., `.createEntity`, `.destroyEntity`, `.archetype`) to ease tests and transitional code.
- `resetGame` performs deterministic respawn of initial fleets and resets AI counters/assignments, blackboard caches (nearest-enemy, threat maps), and clears pending resets so repeated requests don't re-run unexpectedly.
- `destroyEntity` removes Rapier colliders/rigid-bodies defensively, clears collider lookup entries, and relies on the `turretsByShip` registry and `registerTurret`/`unregisterTurret` helpers to do fast cascade removal of turret entities. Tests should continue to call the registry helpers when creating turret entities so the fast path remains valid.
- `disposeGameState` is the complete teardown path: removes all entities, frees Rapier `eventQueue` and `physicsWorld`, and clears registries. It is the canonical teardown used by tests that need to create and destroy a full runtime instance.

Testing & recommendations

- Tests that exercise resets should use `requestReset` where possible and then step the world once to allow the pending reset closure to run; this avoids console errors and reproduces production behaviour.
- AI toggle tests should assert `state.ai.enabled` and validate `blackboard` content on enabled runs; when AI v2 is disabled, legacy behavior or simplified decision helpers should produce the expected commands.
- When spawning entities in tests, prefer creating a minimal `GameState` via `createGameState()` rather than hand-assembling objects; this ensures registries (`turretsByShip`, `colliderLookup`) and sim clocks are present and correctly configured.

Updated: 2025-09-30
