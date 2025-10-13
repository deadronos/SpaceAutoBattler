import type { World as ECSWorld } from 'miniplex';
import type { RapierModule, RapierWorld, EventQueue } from './core.js';
import type { GameEntity, GameQueries, TurretEntity, ProgressionEvent } from './ship.js';
import type { AIManagerState, AIBlackboard, SensorState } from './ai.js';
import type { ExplosionEvent } from './renderer.js';
import type { SeededRng } from '../utils/rng.js';

export type DeferredMutation = () => void;

export interface RapierDiagnostics {
  /** Number of deferred operations that threw during the latest run. */
  deferredMutationFailures: number;
  /** Number of times safety guards skipped or caught Rapier kinematic calls. */
  guardTrips: number;
  /** Most recent tick index when a deferred mutation failed (-1 if never). */
  lastFailureTick: number;
  /** Most recent tick index when a guard trip occurred (-1 if never). */
  lastGuardTick: number;
  /** Optional message captured from the last deferred mutation error. */
  lastDeferredMutationError?: string | undefined;
  /** Total number of Rapier step panics encountered since startup. */
  stepPanics: number;
  /** Most recent tick index when a Rapier step panic was observed (-1 if never). */
  lastStepPanicTick: number;
  /** Simulation time at which the most recent step panic occurred. */
  lastStepPanicTime: number;
  /** Delta seconds for the tick containing the most recent step panic. */
  lastStepPanicDelta: number;
  /** Error message captured from the most recent step panic. */
  lastStepPanicMessage?: string | undefined;
  /** Stack trace captured from the most recent step panic (if available). */
  lastStepPanicStack?: string | undefined;
  /** Wall-clock timestamp (ms) when the most recent step panic snapshot was recorded. */
  lastStepPanicTimestamp: number;
  /** Number of subsystem-level failures encountered since startup. */
  subsystemFailures: number;
  /** Most recent tick index when a subsystem failure occurred (-1 if never). */
  lastSubsystemFailureTick: number;
  /** Error message captured from the most recent subsystem failure (if available). */
  lastSubsystemFailureMessage?: string | undefined;
  /** Stack trace captured from the most recent subsystem failure (if available). */
  lastSubsystemFailureStack?: string | undefined;
  /** Wall-clock timestamp (ms) when the most recent subsystem failure was recorded. */
  lastSubsystemFailureTimestamp: number;
}

export interface SimulationClock {
  /** Fixed step size in seconds for simulation updates. */
  step: number;
  /** Accumulated leftover time awaiting the next simulation step. */
  accumulator: number;
  /** Safety bound to avoid spiralling when frames are very long. */
  maxSubSteps: number;
  /** Normalised interpolation factor (0..1) between last and next sim states. */
  alpha: number;
  /** Monotonic tick counter incremented after each simulation step. */
  lastTickIndex: number;
  /** Simulation time at the start of the latest completed tick. */
  lastTickStart: number;
  /** Duration in seconds of the latest completed tick. */
  lastTickDuration: number;
  /** Deferred world mutation queue drained once per tick before the physics step. */
  deferredMutations: DeferredMutation[];
  /** Deferred operations executed immediately after `physicsWorld.step`. */
  postStepMutations: DeferredMutation[];
  /** Aggregated diagnostics capturing Rapier guard trips and deferred failures. */
  rapierDiagnostics: RapierDiagnostics;
}

export interface HudUiFlags {
  /** Whether HUD health bars are currently enabled. */
  hudHealthBars: boolean;
}

export interface GameState {
  rapier: RapierModule;
  physicsWorld: RapierWorld;
  eventQueue: EventQueue;
  world: ECSWorld<GameEntity>;
  colliderLookup: Map<number, GameEntity>;
  nextEntityId: number;
  nextExplosionId: number;
  time: number;
  queries: GameQueries;
  /** Map from ship entity id -> set of turret entities mounted on that ship. Optional for tests/mocks. */
  turretsByShip?: Map<number, Set<TurretEntity>>;
  rng: SeededRng;
  /** Whether simulation is paused (authoritative mirror of UI state). */
  paused: boolean;
  /** Global time scale multiplier (1 = real-time). */
  timeScale: number;
  /** Simulation clock bookkeeping used for fixed-step integration and interpolation. */
  simulation: SimulationClock;
  ai: AIManagerState;
  sensors?: SensorState;
  blackboard: AIBlackboard;
  /** Flags mirrored from the UI store to keep deterministic playback. */
  uiFlags: HudUiFlags;
  /** Active explosion events pooled for renderer consumption. */
  explosions: ExplosionEvent[];
  /** Recycled explosion events available for reuse to maintain determinism. */
  explosionPool: ExplosionEvent[];
  /** Progression events by ship ID for UI consumption. */
  progressionEvents: Map<number, ProgressionEvent[]>;
}
