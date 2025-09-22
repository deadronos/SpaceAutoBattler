import { Quaternion, Vector3 } from 'three';
import type {
  AIIntent,
  AIState,
  GameState,
  ShipEntity,
  ShipHull,
  Team,
  TeamPosture,
} from '../types/index.js';
import { SeededRng } from '../utils/rng.js';
import { AI_CONFIG, clampToWorld } from './config.js';
import { runDecisionTick } from './systems.js';
import { getDefaultProfileId } from './aiProfiles.js';
import { generateTraitsFromSeed } from './aiTraits.js';

const HARNESS_TEMP = new Vector3();

export interface AIScenarioShipConfig {
  id?: number;
  team: Team;
  hull: ShipHull;
  position: readonly [number, number, number];
  profileId?: string;
  hp?: number;
  maxHp?: number;
  shield?: number;
  maxShield?: number;
  speed?: number;
  range?: number;
  projectileSpeed?: number;
  fireRate?: number;
  bulletType?: string;
  traitSeed?: number;
  velocity?: readonly [number, number, number];
}

export interface AIScenarioConfig {
  name: string;
  ticks: number;
  tickInterval?: number;
  seed?: number;
  aiEnabled?: boolean;
  ships: AIScenarioShipConfig[];
}

export interface AIScenarioCommandLog {
  id: number;
  intent: AIIntent;
  targetId?: number;
  thrust: number;
  fire: boolean;
  heading: readonly [number, number, number];
  lod: 0 | 1 | 2;
  score: number;
}

export interface AIScenarioPositionLog {
  id: number;
  position: readonly [number, number, number];
}

export interface AIScenarioLogEntry {
  tick: number;
  posture: Record<Team, TeamPosture>;
  commands: AIScenarioCommandLog[];
  positions: AIScenarioPositionLog[];
}

export interface AIScenarioLog {
  name: string;
  tickInterval: number;
  seed: number;
  entries: AIScenarioLogEntry[];
}

type HarnessShip = ShipEntity & { __harnessVelocity?: Vector3 };

type HarnessQueries = {
  ships: { entities: HarnessShip[] };
  projectiles: { entities: never[] };
  turrets: { entities: never[] };
};

export function runAIScenario(config: AIScenarioConfig): AIScenarioLog {
  const tickInterval = config.tickInterval ?? 1 / AI_CONFIG.tickRateHz;
  const seed = config.seed ?? 1337;
  const rng = new SeededRng(seed);
  const ships = config.ships.map((spec, index) =>
    createHarnessShip(spec, index, rng, tickInterval),
  );

  const state = {
    ai: {
      enabled: config.aiEnabled ?? true,
      tickInterval,
      maxPerTick: AI_CONFIG.maxPerTick,
      accumulator: 0,
      tickIndex: 0,
      cursor: 0,
      slices: AI_CONFIG.slices,
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
      ships: { entities: ships },
      projectiles: { entities: [] },
      turrets: { entities: [] },
    } as HarnessQueries,
    world: {
      entities: ships,
      createEntity: () => ({}) as ShipEntity,
      destroyEntity: () => undefined,
    } as unknown as GameState['world'],
    physicsWorld: {} as never,
    eventQueue: {} as never,
    colliderLookup: new Map(),
    rapier: {
      RigidBodyDesc: { kinematicPositionBased: () => ({}) },
      ColliderDesc: { ball: () => ({}) },
      ActiveEvents: { COLLISION_EVENTS: 0 },
      ActiveCollisionTypes: { ALL: 0 },
    } as never,
    nextEntityId: ships.length + 1,
    time: 0,
    rng,
    paused: false,
    timeScale: 1,
  } as unknown as GameState;

  const entries: AIScenarioLogEntry[] = [];
  for (let i = 0; i < config.ticks; i += 1) {
    runDecisionTick(state, tickInterval);

    entries.push({
      tick: state.ai.tickIndex,
      posture: { ...state.blackboard.teamPosture },
      commands: serializeCommands(state),
      positions: serializePositions(state),
    });

    applyHarnessIntegration(state, tickInterval);
    state.time += tickInterval;
  }

  return {
    name: config.name,
    tickInterval,
    seed,
    entries,
  };
}

function createHarnessShip(
  spec: AIScenarioShipConfig,
  index: number,
  rng: SeededRng,
  tickInterval: number,
): HarnessShip {
  const id = spec.id ?? index + 1;
  const position = new Vector3(...spec.position);
  const rotation = new Quaternion();
  const hull = spec.hull;
  const profileId = spec.profileId ?? getDefaultProfileId(hull);
  const traitSeed = spec.traitSeed ?? rng.int(1, 1_000_000);
  const ai: AIState = {
    profileId,
    intent: 'Attack',
    nextThinkAt: 0,
    cooldowns: { dodgeAt: 0, burstAt: 0 },
    lod: 0,
    traitSeed,
    traits: generateTraitsFromSeed(traitSeed),
    targetId: undefined,
    lastScore: undefined,
    command: {
      heading: new Vector3(0, 0, 1),
      thrust: 0,
      firePrimary: false,
      ttl: tickInterval,
    },
  };

  const ship: HarnessShip = {
    id,
    rigidBody: createRigidBodyShim(position, rotation, spec.velocity),
    collider: {} as never,
    transform: { position, rotation, scale: 1 },
    ship: {
      team: spec.team,
      hull,
      hp: spec.hp ?? 100,
      maxHp: spec.maxHp ?? spec.hp ?? 100,
      shield: spec.shield ?? 0,
      maxShield: spec.maxShield ?? spec.shield ?? 0,
      shieldRegen: 0,
      cooldown: 0,
      fireRate: spec.fireRate ?? 0.8,
      damage: 8,
      projectileSpeed: spec.projectileSpeed ?? 30,
      range: spec.range ?? 260,
      speed: spec.speed ?? 40,
      bulletType: spec.bulletType ?? 'bullet:laser',
    },
    model: hull,
    ai,
  } as HarnessShip;

  if (spec.velocity) {
    ship.__harnessVelocity = new Vector3(...spec.velocity);
  }

  return ship;
}

function createRigidBodyShim(
  position: Vector3,
  rotation: Quaternion,
  velocity?: readonly [number, number, number],
) {
  const vel = velocity ? new Vector3(...velocity) : new Vector3();
  return {
    setNextKinematicTranslation: ({ x, y, z }: { x: number; y: number; z: number }) => {
      position.set(x, y, z);
    },
    setNextKinematicRotation: ({
      x,
      y,
      z,
      w,
    }: {
      x: number;
      y: number;
      z: number;
      w: number;
    }) => {
      rotation.set(x, y, z, w);
    },
    translation: () => ({ x: position.x, y: position.y, z: position.z }),
    rotation: () => ({ x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w }),
    linvel: () => ({ x: vel.x, y: vel.y, z: vel.z }),
  };
}

function serializeCommands(state: GameState): AIScenarioCommandLog[] {
  const ships = state.queries.ships.entities as HarnessShip[];
  return ships
    .map((ship) => {
      const ai = ship.ai;
      if (!ai) {
        return {
          id: ship.id,
          intent: 'Attack',
          thrust: 0,
          fire: false,
          heading: [0, 0, 0] as const,
          lod: 2,
          score: 0,
        } satisfies AIScenarioCommandLog;
      }

      const heading = normalizeForLog(ai.command.heading);
      const thrust = clampNumber(ai.command.thrust, 3);
      return {
        id: ship.id,
        intent: ai.intent,
        targetId: ai.command.targetId ?? ai.targetId,
        thrust,
        fire: ai.command.firePrimary,
        heading,
        lod: ai.lod,
        score: ai.lastScore ?? 0,
      } satisfies AIScenarioCommandLog;
    })
    .sort((a, b) => a.id - b.id);
}

function serializePositions(state: GameState): AIScenarioPositionLog[] {
  const ships = state.queries.ships.entities as HarnessShip[];
  return ships
    .map((ship) => ({
      id: ship.id,
      position: normalizeForLog(ship.transform.position),
    }))
    .sort((a, b) => a.id - b.id);
}

function normalizeForLog(vec: Vector3): readonly [number, number, number] {
  return [
    clampNumber(vec.x, 3),
    clampNumber(vec.y, 3),
    clampNumber(vec.z, 3),
  ] as const;
}

function clampNumber(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function applyHarnessIntegration(state: GameState, delta: number): void {
  const ships = state.queries.ships.entities as HarnessShip[];
  for (const ship of ships) {
    const ai = ship.ai;
    if (!ai) continue;
    const heading = HARNESS_TEMP.copy(ai.command.heading);
    if (heading.lengthSq() < 1e-5) {
      heading.set(0, 0, 1).applyQuaternion(ship.transform.rotation);
    } else {
      heading.normalize();
    }
    const thrust = Math.max(0, Math.min(1, ai.command.thrust));
    const move = ship.ship.speed * thrust * delta;
    ship.transform.position.addScaledVector(heading, move);
    if (ship.__harnessVelocity) {
      ship.transform.position.addScaledVector(ship.__harnessVelocity, delta);
    }
    clampToWorld(ship.transform.position);
  }
}
