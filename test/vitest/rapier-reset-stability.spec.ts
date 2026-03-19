import { describe, it, expect, beforeEach, afterEach } from 'vite-plus/test';
import {
  createGameState,
  requestReset,
  resetGame,
  disposeGameState,
  spawnInitialFleets,
} from '../../src/game/state.js';
import { updateGame } from '../../src/game/systems.js';
import type { GameEntity, GameState } from '../../src/types/index.js';

describe('Rapier Reset Stability', () => {
  let state: GameState;

  beforeEach(async () => {
    state = await createGameState();
  });

  afterEach(() => {
    if (state) {
      disposeGameState(state);
    }
  });

  it('initializes SimulationClock with empty post-step queue', () => {
    expect(state.simulation.postStepMutations).toHaveLength(0);
  });

  it('requestReset enqueues a post-step mutation without executing immediately', () => {
    spawnInitialFleets(state);
    const initialEntityCount = state.world.entities.length;

    requestReset(state);

    expect(state.simulation.postStepMutations).toHaveLength(1);
    expect(state.world.entities.length).toBe(initialEntityCount);
  });

  it('drains the post-step queue after the physics step', () => {
    spawnInitialFleets(state);
    const initialEntityCount = state.world.entities.length;
    expect(initialEntityCount).toBeGreaterThan(0);

    requestReset(state);
    expect(state.simulation.postStepMutations).toHaveLength(1);

    updateGame(state, 1 / 60);

    expect(state.simulation.postStepMutations).toHaveLength(0);
    expect(state.world.entities.length).toBeGreaterThan(0);
  });

  it('coalesces multiple reset requests into a single queued operation', () => {
    spawnInitialFleets(state);

    requestReset(state);
    requestReset(state);
    requestReset(state);

    expect(state.simulation.postStepMutations).toHaveLength(1);

    updateGame(state, 1 / 60);

    expect(state.simulation.postStepMutations).toHaveLength(0);
  });

  it('direct resetGame clears any queued post-step resets', () => {
    spawnInitialFleets(state);
    requestReset(state);
    expect(state.simulation.postStepMutations).toHaveLength(1);

    resetGame(state);

    expect(state.simulation.postStepMutations).toHaveLength(0);
  });

  it('uses modern EventQueue initialization', () => {
    expect(state.eventQueue).toBeDefined();
    expect(state.eventQueue.free).toBeTypeOf('function');
  });

  it('resetGame clears interrupt state and reseeds RNG for deterministic fresh matches', () => {
    spawnInitialFleets(state);
    type SpawnSnapshotEntry = {
      team: string | null;
      hull: string | null;
      position: { x: number; y: number; z: number } | null;
    };
    const toSpawnSnapshot = () =>
      state.queries.ships.entities
        .map(
          (entity: GameEntity): SpawnSnapshotEntry => ({
            team: entity.ship?.team ?? null,
            hull: entity.ship?.hull ?? null,
            position: entity.transform
              ? {
                  x: entity.transform.position.x,
                  y: entity.transform.position.y,
                  z: entity.transform.position.z,
                }
              : null,
          }),
        )
        .sort((a: SpawnSnapshotEntry, b: SpawnSnapshotEntry) => {
          const teamCompare = (a.team ?? '').localeCompare(b.team ?? '');
          if (teamCompare !== 0) return teamCompare;
          const hullCompare = (a.hull ?? '').localeCompare(b.hull ?? '');
          if (hullCompare !== 0) return hullCompare;
          const ax = a.position?.x ?? 0;
          const bx = b.position?.x ?? 0;
          if (ax !== bx) return ax - bx;
          const ay = a.position?.y ?? 0;
          const by = b.position?.y ?? 0;
          if (ay !== by) return ay - by;
          const az = a.position?.z ?? 0;
          const bz = b.position?.z ?? 0;
          return az - bz;
        });
    const initialSpawn = toSpawnSnapshot();

    state.ai.interrupts?.push({ shipId: 1, reason: 'manual', tick: 1 });
    state.ai.interruptState?.cooldownTick.set('manual:1', 10);
    state.ai.interruptState?.damageThisTick.set(1, 42);
    if (state.ai.interruptState) {
      state.ai.interruptState.lastDamageTick = 99;
      state.ai.interruptState.vipThreatAssignments.set(7, 3);
    }
    state.rng.next();
    state.rng.next();

    resetGame(state);

    expect(state.ai.interrupts).toEqual([]);
    expect(state.ai.interruptState?.cooldownTick.size).toBe(0);
    expect(state.ai.interruptState?.damageThisTick.size).toBe(0);
    expect(state.ai.interruptState?.lastDamageTick).toBe(-1);
    expect(state.ai.interruptState?.vipThreatAssignments.size).toBe(0);
    const resetSpawn = toSpawnSnapshot();
    expect(resetSpawn).toEqual(initialSpawn);
  });
});
