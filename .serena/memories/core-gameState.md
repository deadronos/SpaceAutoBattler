# core/gameState

Last-Reviewed: 2025-10-05

**Memory name:** core-gameState (authoritative snapshot)

Summary:

- Canonical GameState type definition: `src/types/simulation.ts` (re-exported from `src/types/index.ts`). The authoritative interface is declared in `simulation.ts`.
- Runtime factory and helpers: `createGameState(opts?: { seed?: number|string })` and lifecycle helpers live in `src/game/state.ts`.

Primary exports and responsibilities (source locations):

- `createGameState(opts?): Promise<GameState>` — `src/game/state.ts`
  - Initializes Rapier WASM, constructs the physics world and entity ECS, creates a seeded RNG instance (`SeededRng` from `src/utils/rng.ts`), and returns a ready `GameState` object.
- `disposeGameState(state: GameState): void` — `src/game/state.ts`
  - Tears down Rapier world and frees any pooled renderer/physics resources tied to the state.
- `destroyEntity(state: GameState, id: number | string): void` — `src/game/state.ts`
  - Removes entities and their runtime attachments/physics bodies from the `GameState` safely.
- `spawnInitialFleets(state: GameState, config?): void` — `src/game/ships.ts` / `src/game/state.ts`
  - Convenience helper used by demo pages and tests to populate the world.

Snapshot of the authoritative `GameState` interface (fields taken from `src/types/simulation.ts`):

- rapier: RapierModule
- physicsWorld: RapierWorld
- eventQueue: EventQueue
- world: ECSWorld<GameEntity>
- colliderLookup: Map<number, GameEntity>
- nextEntityId: number
- nextExplosionId: number
- time: number
- queries: GameQueries
- turretsByShip?: Map<number, Set<TurretEntity>> (optional for tests/mocks)
- rng: SeededRng
- paused: boolean
- timeScale: number
- simulation: SimulationClock
- ai: AIManagerState
- blackboard: AIBlackboard
- uiFlags: HudUiFlags
- explosions: ExplosionEvent[]
- explosionPool: ExplosionEvent[]
- progressionEvents: Map<number, ProgressionEvent[]>

Runtime patterns and verification notes:

- All runtime state is stored on the `GameState` object — avoid module-level runtime state.
- Determinism: use the `SeededRng` instance attached to the `GameState` for any simulation-random decisions.
- The `GameState` shape is defined in `src/types/simulation.ts` and re-exported by `src/types/index.ts` for convenience.

References (checked on 2025-10-05):
- `src/game/state.ts` (factory and lifecycle helpers)
- `src/types/simulation.ts` (interface definition)
- `src/utils/rng.ts` (SeededRng implementation)

Notes:
- Keep this memory as the authoritative summary for where to find the runtime factory and the canonical GameState type. Update this memory whenever the `GameState` interface or the location of the factory moves.