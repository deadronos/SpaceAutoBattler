simulateStep(state: GameState, dt: number)
- Purpose: Advance the simulation by a fixed time-step. Handles AI updates, spatial grid updates, turret firing, bullet updates, deaths/XP handling, level ups, carrier spawning, and periodic boundary cleanup.
- Inputs: `state` (mutable GameState object), `dt` (number of seconds to advance - typically fixed step 1 / tickRate).
- Outputs: None (mutates `state`).
- Side effects:
  - Mutates ship positions/velocities via AI and physics stepper interactions.
  - Updates `state.time` and `state.tick` occur at caller loop level (main loop increments these around simulateStep).
  - May create bullets in `state.bullets` and change ship health/XP/levels.
  - May modify `state.spatialGrid` and `state.shipIndex`.
  - May spawn fighters (carrier logic) via `spawnShip`.
- Error modes:
  - Expects `state` has valid structures (arrays, maps); missing `state.ships` or `state.simConfig` may throw.
  - Physics stepper errors are caught/ignored inside loops in practice but callers should handle exceptions when calling `state.physicsStepper?.step`.
- Contract:
  - Idempotent only relative to dt and prior state; expected to be called with consistent fixed-step dt for deterministic simulations when using seeded RNG.

spawnShip(state: GameState, team: Team, cls: ShipClass, pos?: Vector3, parentCarrierId?: EntityId) => Ship
- Purpose: Create and initialize a Ship entity in the provided `state`.
- Inputs:
  - `state` (GameState mutable)
  - `team` ('red' | 'blue')
  - `cls` (one of ship classes: 'fighter','corvette','frigate','destroyer','carrier')
  - `pos` optional spawn position; if omitted, use `randomSpawnPos` which uses state.rng
  - `parentCarrierId` optional ID to link fighters to carrier
- Outputs: Returns the created `Ship` object and appends it to `state.ships`.
- Side effects:
  - Increments `state.nextId`; updates `state.ships` array and `state.shipIndex` Map.
  - Initializes stats (health, shield, armor, turrets) using `config` lookups and level-based scaling.
  - May apply spawn jitter depending on `state.behaviorConfig.globalSettings.enableSpawnJitter`.
- Error modes:
  - Requires valid ship class config via `getShipClassConfig`; missing configs will throw.
- Contract guarantees:
  - Returns a ship with a unique `id` (from state's nextId) and defaulted fields as per config.

createInitialState(seed?: string) => GameState
- Purpose: Construct a fresh `GameState` object with defaults and seeded RNG.
- Inputs: optional `seed` string; if omitted and `useTimeBasedSeed` true in `DefaultSimConfig` then a time-based seed is used.
- Outputs: Returns a `GameState` object with initialized fields: time, tick, running=false, rng, nextId=1, simConfig, ships=[], bullets=[], score, behaviorConfig, and spatialGrid if enabled.
- Side effects: None external; returns new object.
- Contract guarantees: RNG created via `createRNG(seed)` and attached to `state.rng` so deterministic runs possible when seed is set.

resetState(state: GameState, seed?: string)
- Purpose: Reset an existing GameState in-place to initial values and optionally re-seed RNG.
- Inputs: `state` (GameState mutable), optional `seed`.
- Outputs: None (mutates `state`).
- Side effects:
  - Resets time, tick, running, speedMultiplier, nextId, ships, bullets, scores, aiController.
  - Recreates `state.rng` using provided or existing seed.
  - Reinitializes `state.spatialGrid` according to `behaviorConfig.globalSettings.enableSpatialIndex`.
- Error modes: Expects provided object to follow GameState shape; missing nested config may throw.

Notes:
- For deterministic simulations ensure: always use fixed dt, set seed via `createInitialState(seed)` or `resetState(state, seed)`, and avoid non-deterministic behaviors like Date.now in runtime-critical paths.
- Preferred caller behavior: main loop advances `state.time` and `state.tick` outside `simulateStep` (the loop in `src/main.ts` does this).