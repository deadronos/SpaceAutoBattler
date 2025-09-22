#!/usr/bin/env node

import { performance } from 'node:perf_hooks';
import process from 'node:process';
import { Quaternion, Vector3 } from 'three';
import type { GameState, ShipEntity } from '../../src/types/index.js';
import { __aiTestHooks } from '../../src/game/systems.js';

const { updateDecisionSystem } = __aiTestHooks;

console.log('[ai-budget] booting harness');

function parseNumber(value: string | undefined, fallback: number): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

const SHIP_COUNT = parseNumber(process.env.AI_BUDGET_SHIPS, 300);
const TICKS = parseNumber(process.env.AI_BUDGET_TICKS, 160);
const BUDGET_MS = parseNumber(process.env.AI_BUDGET_MS, 2.5);

function createRigidBodyStub() {
  return {
    setNextKinematicTranslation: () => {},
    setNextKinematicRotation: () => {},
  };
}

function createShip(id: number, team: 'blue' | 'red', position: Vector3): ShipEntity {
  return {
    id,
    rigidBody: createRigidBodyStub() as never,
    collider: {} as never,
    transform: {
      position: position.clone(),
      rotation: new Quaternion(),
      scale: 1,
    },
    ship: {
      team,
      hull: 'fighter',
      hp: 60,
      maxHp: 60,
      shield: 0,
      maxShield: 0,
      shieldRegen: 0,
      cooldown: 0,
      fireRate: 1,
      damage: 6,
      projectileSpeed: 30,
      range: 260,
      speed: 40,
      bulletType: 'bullet:laser',
    },
    model: 'fighter',
    ai: {
      profileId: team === 'blue' ? 'brawler' : 'escort',
      intent: 'Attack',
      nextThinkAt: 0,
      cooldowns: { dodgeAt: 0, burstAt: 0 },
      lod: 0,
      traitSeed: id * 97,
      traits: { aggression: 1, patience: 1, dodge: 1 },
      command: {
        heading: new Vector3(0, 0, 1),
        thrust: 0,
        firePrimary: false,
        ttl: 0.1,
      },
    },
  } as ShipEntity;
}

function createState(): GameState {
  return {
    ai: {
      enabled: true,
      tickInterval: 0.1,
      maxPerTick: Math.max(20, Math.ceil(SHIP_COUNT / 5)),
      accumulator: 0,
      tickIndex: 0,
      cursor: 0,
      slices: 1,
      assignments: { escorts: new Map() },
      metrics: {
        totalDecisions: 0,
        totalSkipped: 0,
        budgetHits: 0,
        lastDecisions: 0,
        lastSkipped: 0,
        lastSliceSize: 0,
        lastTotalShips: 0,
      },
    },
    blackboard: {
      tickIndex: 0,
      teamPosture: { blue: 'hold', red: 'hold' },
      allyCentroid: { blue: new Vector3(), red: new Vector3() },
      nearestEnemy: new Map(),
      threatToVip: new Map(),
      tmpVectors: [new Vector3(), new Vector3(), new Vector3(), new Vector3()],
    },
    queries: {
      ships: { entities: [] as ShipEntity[] },
      projectiles: { entities: [] as never[] },
      turrets: { entities: [] as never[] },
    },
    world: {} as never,
    physicsWorld: {} as never,
    eventQueue: {} as never,
    colliderLookup: new Map(),
    rapier: {} as never,
    nextEntityId: 1,
    time: 0,
    rng: {} as never,
    paused: false,
    timeScale: 1,
  } as unknown as GameState;
}

function populateShips(state: GameState): void {
  const ships = state.queries.ships.entities as unknown as ShipEntity[];
  const half = Math.ceil(SHIP_COUNT / 2);
  const spacing = 80;
  const columns = Math.max(1, Math.ceil(Math.sqrt(half)));
  let id = 1;
  for (let i = 0; i < half; i += 1) {
    const column = i % columns;
    const row = Math.floor(i / columns);
    ships.push(createShip(id++, 'blue', new Vector3(-320 + column * spacing, 0, (row - columns / 2) * spacing)));
  }
  for (let i = 0; i < SHIP_COUNT - half; i += 1) {
    const column = i % columns;
    const row = Math.floor(i / columns);
    ships.push(createShip(id++, 'red', new Vector3(320 - column * spacing, 0, (row - columns / 2) * spacing)));
  }
}

async function main(): Promise<void> {
  const state = createState();
  try {
    populateShips(state);
    const dt = state.ai.tickInterval;
    const start = performance.now();
    for (let i = 0; i < TICKS; i += 1) {
      updateDecisionSystem(state, dt);
    }
    const duration = performance.now() - start;
    const avg = duration / TICKS;

    console.log(
      `[ai-budget] ships=${SHIP_COUNT} ticks=${TICKS} avgTick=${avg.toFixed(3)}ms budget=${BUDGET_MS.toFixed(3)}ms`,
    );

    if (avg > BUDGET_MS) {
      console.error(
        `[ai-budget] FAIL: average AI tick ${avg.toFixed(3)}ms exceeds budget ${BUDGET_MS.toFixed(3)}ms`,
      );
      process.exitCode = 1;
    } else {
      console.log(
        `[ai-budget] PASS: average AI tick ${avg.toFixed(3)}ms within budget ${BUDGET_MS.toFixed(3)}ms`,
      );
    }
  } catch (error) {
    console.error('[ai-budget] error while running budget assertion', error);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('[ai-budget] unhandled error', error);
  process.exitCode = 1;
});
