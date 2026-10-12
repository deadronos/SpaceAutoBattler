import { describe, expect, it } from 'vite-plus/test';
import { Quaternion, Vector3 } from 'three';
import { createDefaultMetrics } from '../../src/game/metrics.js';
import { refreshBlackboard } from '../../src/game/systems/decision/blackboard.js';
import { getSensorBroadphaseGrid, updateSensorSystem } from '../../src/game/systems/sensors.js';
import { createDefaultMotionStats } from '../../src/game/ships.js';
import type { GameState, SensorVisibility, ShipEntity, Team } from '../../src/types/index.js';

/**
 * Equivalence spec for Task 3 (#642).
 *
 * `refreshBlackboard` resolves each ship's nearest enemy either through the
 * sensor broad-phase grid (`queryNearest`) or, when the grid is unavailable,
 * through the legacy O(N^2) double loop. These tests prove both paths produce
 * byte-identical `nearestEnemy` maps: the same candidate set (identity/team/
 * visibility filter) and the same winner (smallest `distSq`, ties broken by the
 * earliest `ships` index).
 */

interface ShipSpec {
  id: number;
  team: Team;
  pos: [number, number, number];
}

type VisibilitySpec = { blue?: number[]; red?: number[] };

const TEAMS: readonly Team[] = ['blue', 'red'];

function makeShip(spec: ShipSpec): ShipEntity {
  return {
    id: spec.id,
    rigidBody: {
      setNextKinematicTranslation: () => undefined,
      setNextKinematicRotation: () => undefined,
      translation: () => ({ x: spec.pos[0], y: spec.pos[1], z: spec.pos[2] }),
      rotation: () => ({ x: 0, y: 0, z: 0, w: 1 }),
      linvel: () => ({ x: 0, y: 0, z: 0 }),
    } as never,
    collider: {} as never,
    transform: {
      position: new Vector3(spec.pos[0], spec.pos[1], spec.pos[2]),
      rotation: new Quaternion(),
      scale: 1,
    },
    ship: {
      team: spec.team,
      hull: 'fighter',
      hp: 100,
      maxHp: 100,
      shield: 0,
      maxShield: 0,
      shieldRegen: 0,
      cooldown: 0,
      fireRate: 1,
      damage: 10,
      projectileSpeed: 35,
      range: 260,
      speed: 40,
      bulletType: 'bullet:laser',
      velocity: new Vector3(),
      angularVelocity: new Vector3(),
      lateralAcceleration: 0,
      motion: createDefaultMotionStats(),
    },
    model: 'fighter',
  } as unknown as ShipEntity;
}

function makeState(ships: ShipEntity[]): GameState {
  return {
    ai: {
      enabled: true,
      tickInterval: 0.1,
      tickIndex: 1,
      accumulator: 0,
      cursor: 0,
      maxPerTick: 10,
      slices: 1,
      assignments: { escorts: new Map() },
      metrics: createDefaultMetrics(),
      interrupts: [],
      interruptState: {
        cooldownTick: new Map(),
        damageThisTick: new Map(),
        lastDamageTick: -1,
        vipThreatAssignments: new Map(),
      },
    },
    blackboard: {
      tickIndex: 1,
      teamPosture: { blue: 'hold', red: 'hold' },
      allyCentroid: { blue: new Vector3(), red: new Vector3() },
      nearestEnemy: new Map(),
      threatToVip: new Map(),
      tmpVectors: [],
      strengthRatio: { blue: 1, red: 1 },
      teamPriority: { blue: [], red: [] },
      priorityIndex: { blue: new Map(), red: new Map() },
      focusFire: { blue: new Map(), red: new Map() },
      visibleEnemies: { blue: new Map(), red: new Map() },
      teamCounts: { blue: 0, red: 0 },
    },
    sensors: {
      lastUpdateTick: -1,
      visibilityByTeam: { blue: new Map(), red: new Map() },
      decayRate: 0.65,
      threshold: 0.18,
      staleDecay: 0.55,
    },
    queries: {
      ships: { entities: ships },
      projectiles: { entities: [] },
      turrets: { entities: [] },
    },
    world: { entities: ships },
    physicsWorld: {} as never,
    eventQueue: {} as never,
    colliderLookup: new Map(),
    shipById: new Map(),
    rapier: {} as never,
    nextEntityId: 1000,
    nextExplosionId: 1,
    time: 0,
    rng: {} as never,
    paused: false,
    timeScale: 1,
  } as unknown as GameState;
}

function setVisibility(state: GameState, visible: VisibilitySpec): void {
  for (const team of TEAMS) {
    const map = state.blackboard.visibleEnemies![team];
    map.clear();
    for (const id of visible[team] ?? []) {
      map.set(id, {
        strength: 1,
        lastSeenTick: 1,
        sourceId: 0,
        occluded: false,
        distance: 0,
      } satisfies SensorVisibility);
    }
  }
}

/** Runs the legacy double-loop path (grid not populated → `null`). */
function nearestViaFallback(ships: ShipEntity[], visible: VisibilitySpec): Map<number, number> {
  const state = makeState(ships);
  setVisibility(state, visible);
  expect(getSensorBroadphaseGrid(state)).toBeNull();
  refreshBlackboard(state, ships);
  return new Map(state.blackboard.nearestEnemy);
}

/** Runs the broad-phase grid path (populated exactly as `manager.ts` does). */
function nearestViaGrid(ships: ShipEntity[], visible: VisibilitySpec): Map<number, number> {
  const state = makeState(ships);
  updateSensorSystem(state, ships);
  // `updateSensorSystem` rewrites `visibleEnemies`; pin the desired filter so the
  // two paths are compared under identical visibility inputs.
  setVisibility(state, visible);
  expect(getSensorBroadphaseGrid(state)).not.toBeNull();
  refreshBlackboard(state, ships);
  return new Map(state.blackboard.nearestEnemy);
}

function comparePaths(
  specs: ShipSpec[],
  visible: VisibilitySpec = {},
): {
  fallback: Map<number, number>;
  grid: Map<number, number>;
} {
  const ships = specs.map(makeShip);
  const fallback = nearestViaFallback(ships, visible);
  const grid = nearestViaGrid(ships, visible);
  expect(grid).toEqual(fallback);
  return { fallback, grid };
}

describe('nearest-enemy via sensor broad-phase grid', () => {
  it('matches the fallback for exact-distance ties (earliest ships index wins)', () => {
    const specs: ShipSpec[] = [
      { id: 10, team: 'blue', pos: [0, 0, 0] },
      { id: 20, team: 'red', pos: [100, 0, 0] },
      { id: 21, team: 'red', pos: [-100, 0, 0] },
    ];
    const { fallback, grid } = comparePaths(specs);
    expect(fallback.get(10)).toBe(20);
    expect(grid.get(10)).toBe(20);
  });

  it('breaks cross-cell distance ties by ships index', () => {
    const specs: ShipSpec[] = [
      { id: 10, team: 'blue', pos: [0, 0, 0] },
      { id: 30, team: 'red', pos: [150, 0, 0] },
      { id: 25, team: 'red', pos: [-150, 0, 0] },
    ];
    // id 30 sits in cell 0 (ring 0); id 25 in cell -1 (ring 1). Equal distSq,
    // so the earliest ships index (id 30, despite the larger id) must win on
    // both paths — proving the tie-break is positional, not id-based.
    const { fallback, grid } = comparePaths(specs);
    expect(fallback.get(10)).toBe(30);
    expect(grid.get(10)).toBe(30);
  });

  it('matches with empty visibleEnemies (no visibility filter)', () => {
    const specs: ShipSpec[] = [
      { id: 10, team: 'blue', pos: [0, 0, 0] },
      { id: 11, team: 'blue', pos: [40, 0, 0] },
      { id: 20, team: 'red', pos: [900, 0, 0] },
      { id: 21, team: 'red', pos: [120, 0, 0] },
      { id: 22, team: 'red', pos: [260, 30, -10] },
    ];
    const { fallback, grid } = comparePaths(specs);
    expect(fallback.get(10)).toBe(21);
    expect(grid.get(10)).toBe(21);
  });

  it('matches with populated visibleEnemies (visibility filter applied)', () => {
    const specs: ShipSpec[] = [
      { id: 10, team: 'blue', pos: [0, 0, 0] },
      { id: 20, team: 'red', pos: [80, 0, 0] },
      { id: 21, team: 'red', pos: [200, 0, 0] },
      { id: 22, team: 'red', pos: [400, 0, 0] },
    ];
    // Only id 21 is visible to blue, even though id 20 is closer.
    const { fallback, grid } = comparePaths(specs, { blue: [21] });
    expect(fallback.get(10)).toBe(21);
    expect(grid.get(10)).toBe(21);
  });

  it('matches across multi-team mixes with per-team visibility', () => {
    const specs: ShipSpec[] = [
      { id: 1, team: 'blue', pos: [-300, 0, 0] },
      { id: 2, team: 'blue', pos: [0, 0, 0] },
      { id: 3, team: 'blue', pos: [250, 0, 120] },
      { id: 4, team: 'red', pos: [-260, 0, 40] },
      { id: 5, team: 'red', pos: [70, 0, 0] },
      { id: 6, team: 'red', pos: [420, 0, -90] },
      { id: 7, team: 'red', pos: [30, 0, 400] },
    ];
    const { fallback, grid } = comparePaths(specs, { blue: [5, 6], red: [1, 3] });
    // Blue only sees 5/6 → 2's nearest is 5; red only sees 1/3.
    expect(fallback.get(2)).toBe(5);
    expect(grid.get(2)).toBe(5);
    expect(fallback.get(5)).toBe(3);
    expect(grid.get(5)).toBe(3);
  });

  it('matches on a deterministic many-ship layout', () => {
    const specs: ShipSpec[] = [];
    let id = 1;
    for (let i = 0; i < 24; i += 1) {
      const team: Team = i % 2 === 0 ? 'blue' : 'red';
      // Deterministic pseudo-scatter spanning several cells, with deliberate
      // distance ties injected every fourth ship.
      const x = i % 6 === 0 ? 300 : ((i * 137) % 900) - 450;
      const y = ((i * 53) % 400) - 200;
      const z = ((i * 211) % 800) - 400;
      specs.push({ id: id++, team, pos: [x, y, z] });
    }
    comparePaths(specs);
  });

  it('produces an empty map when no enemies exist', () => {
    const specs: ShipSpec[] = [
      { id: 1, team: 'blue', pos: [0, 0, 0] },
      { id: 2, team: 'blue', pos: [50, 0, 0] },
    ];
    const { fallback, grid } = comparePaths(specs);
    expect(fallback.size).toBe(0);
    expect(grid.size).toBe(0);
  });
});
