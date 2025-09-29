import { Quaternion, Vector3 } from 'three';
import type {
  AIIntent,
  AIIntentSnapshot,
  AIKpiSummary,
  AIMetrics,
  AIState,
  GameState,
  ShipEntity,
  ShipHull,
  Team,
  TeamPosture,
} from '../types/index.js';
import { createDefaultMotionStats } from './ships.js';
import { SeededRng } from '../utils/rng.js';
import { AI_CONFIG, clampToWorld } from './config.js';
import { runDecisionTick, __aiTestHooks, fireProjectile } from './systems.js';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { getDefaultProfileId, resolveBehaviorProfile } from './aiProfiles.js';
import { generateTraitsFromSeed } from './aiTraits.js';
import { createDefaultMetrics, aggregateKpis, SHIP_HULLS, recordShotMetrics } from './metrics.js';
import { createProgressionDefaults, createSubsystems } from './progression.js';

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

export interface AIScenarioMetrics {
  kpis: AIKpiSummary;
  firstShotTimes: number[];
  intentTimeline: AIIntentSnapshot[];
  shotDistance: Record<ShipHull, { buckets: readonly number[]; counts: number[]; total: number }>;
  shotDeltaY: Record<ShipHull, { buckets: readonly number[]; counts: number[]; total: number }>;
}

export interface AIScenarioLog {
  name: string;
  tickInterval: number;
  seed: number;
  entries: AIScenarioLogEntry[];
  metrics: AIScenarioMetrics;
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
      tickIndex: 0,
      teamPosture: { blue: 'hold', red: 'hold' },
      allyCentroid: { blue: new Vector3(), red: new Vector3() },
      nearestEnemy: new Map(),
      threatToVip: new Map(),
      tmpVectors: [new Vector3(), new Vector3(), new Vector3(), new Vector3()],
      strengthRatio: { blue: 1, red: 1 },
      teamPriority: { blue: [], red: [] },
      priorityIndex: { blue: new Map(), red: new Map() },
      focusFire: { blue: new Map(), red: new Map() },
      teamCounts: { blue: 0, red: 0 },
      verticalDispersion: {
        headingYSamples: [],
        positionYSamples: [],
        lastUpdateTick: -1,
      },
    },
    queries: {
      ships: { entities: ships },
      projectiles: { entities: [] },
      turrets: { entities: [] },
    } as HarnessQueries,
    world: {
      entities: ships,
      createEntity: (entity: unknown) => {
        // Add projectile to queries for metrics tracking
        (state.queries.projectiles.entities as unknown[]).push(entity);
        return entity as ShipEntity;
      },
      // Newer API alias used by miniplex v2
      add: (entity: unknown) => {
        // Add projectile to queries for metrics tracking
        (state.queries.projectiles.entities as unknown[]).push(entity);
        return entity as ShipEntity;
      },
      destroyEntity: () => undefined,
      // Newer API alias used by miniplex v2
      remove: () => undefined,
    } as unknown as GameState['world'],
    physicsWorld: {
      createRigidBody: (desc: { translation: { x: number; y: number; z: number }; rotation: { x: number; y: number; z: number; w: number } }) => ({
        translation: () => ({ ...desc.translation }),
        rotation: () => ({ ...desc.rotation }),
        setNextKinematicTranslation: () => undefined,
        setNextKinematicRotation: () => undefined,
      }),
      createCollider: (desc: { radius?: number }, body: unknown) => ({
        handle: Math.random(), // Simple handle for testing
        radius: desc.radius ?? 0,
        body,
      }),
    } as never,
    eventQueue: {} as never,
    colliderLookup: new Map(),
    rapier: {
      RigidBodyDesc: {
        kinematicPositionBased: () => ({
          translation: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0, w: 1 },
          setTranslation(x: number, y: number, z: number) {
            this.translation = { x, y, z };
            return this;
          },
          setRotation(rotation: { x: number; y: number; z: number; w: number }) {
            this.rotation = { ...rotation };
            return this;
          },
        }),
      },
      ColliderDesc: {
        ball: (radius: number) => ({
          radius,
          setActiveEvents() {
            return this;
          },
          setActiveCollisionTypes() {
            return this;
          },
        }),
      },
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
  // Diagnostic: for a small set of known flaky seeds, dump per-ship
  // candidate scoring to tmp/ai-diagnostic-<seed>.log to help tuning.
    // This is intentionally lightweight and only enabled for the
    // scenario seeds that are currently under investigation.
    const DIAG_SEEDS = new Set([777, 2029, 4041]);
    try {
      if (DIAG_SEEDS.has(seed)) {
        const outDir = join('.', 'tmp');
        const path = join(outDir, `ai-diagnostic-${seed}.log`);
        const lines: string[] = [];
        const shipsList = state.queries.ships.entities as HarnessShip[];
        for (const ship of shipsList) {
          if (!ship.ai) continue;
          const ai = ship.ai;
          const profileId = ai.profileId;
          const profile = resolveBehaviorProfile(profileId);
          // Build candidates using the exported test hook if available.
          try {
            const nearest = state.blackboard.nearestEnemy.get(ship.id);
            const primaryTarget =
              nearest != null
                ? ((state.queries.ships.entities as HarnessShip[]).find((s) => s.id === nearest) ?? null)
                : null;
            const escortAssignment = state.ai?.assignments?.escorts?.get?.(ship.id) ?? null;
            const escortTarget = escortAssignment
              ? ((state.queries.ships.entities as HarnessShip[]).find((s) => s.id === escortAssignment.vipId) ?? null)
              : null;
            type LocalCandidate = { intent: AIIntent; score: number; target?: ShipEntity | null };
            const candidates: LocalCandidate[] = [];
            // Use the same scoring helpers exported from systems for accuracy
            candidates.push({ intent: 'Attack', score: __aiTestHooks.scoreAttackIntent(state as unknown as GameState, ship as unknown as ShipEntity, profile, primaryTarget as unknown as ShipEntity | null, state.blackboard.teamPosture[ship.ship.team], ai.traits) });
            candidates.push({ intent: 'Kite', score: __aiTestHooks.scoreKiteIntent(ship as unknown as ShipEntity, profile, primaryTarget as unknown as ShipEntity | null, state.blackboard.teamPosture[ship.ship.team], ai.traits) });
            if (escortTarget)
              candidates.push({
                intent: 'Escort',
                score: __aiTestHooks.scoreEscortIntent(
                  ship as unknown as ShipEntity,
                  profile,
                  escortTarget as unknown as ShipEntity,
                  state as unknown as GameState,
                  ai.traits,
                  escortAssignment,
                ),
              });
            if (primaryTarget) {
              candidates.push({
                intent: 'Intercept',
                score: __aiTestHooks.scoreInterceptIntent(
                  state as unknown as GameState,
                  ship as unknown as ShipEntity,
                  profile,
                  primaryTarget as unknown as ShipEntity,
                  escortTarget as unknown as ShipEntity | null,
                  state.blackboard.teamPosture[ship.ship.team],
                  ai.traits,
                  escortAssignment,
                ),
              });
              candidates.push({ intent: 'Reposition', score: __aiTestHooks.scoreRepositionIntent(state as unknown as GameState, ship as unknown as ShipEntity, profile, primaryTarget as unknown as ShipEntity, ai.traits, state.blackboard.teamPosture[ship.ship.team]) });
            } else {
              candidates.push({ intent: 'Reposition', score: __aiTestHooks.scoreRepositionIntent(state as unknown as GameState, ship as unknown as ShipEntity, profile, null, ai.traits, state.blackboard.teamPosture[ship.ship.team]) });
            }
            candidates.push({ intent: 'Regroup', score: __aiTestHooks.scoreRegroupIntent(state as unknown as GameState, ship as unknown as ShipEntity, profile, state.blackboard.teamPosture[ship.ship.team], ai.traits) });
            candidates.push({ intent: 'Flee', score: __aiTestHooks.scoreFleeIntent(ship as unknown as ShipEntity, profile, primaryTarget as unknown as ShipEntity | null, state.blackboard.teamPosture[ship.ship.team], ai.traits) });
            candidates.sort((a, b) => b.score - a.score);
            const chosen = __aiTestHooks.tieBreak(ai as unknown as AIState, state.ai.tickIndex, candidates as unknown as any as any[]);
            lines.push(`tick=${state.ai.tickIndex} ship=${ship.id} intent=${ai.intent} lastScore=${ai.lastScore} chosen=${chosen?.intent} candidates=${candidates.map((c) => `${c.intent}:${c.score}`).join(',')}`);
          } catch {
            // ignore diagnostics errors
          }
        }
        // fire-and-forget async write to avoid blocking
        void (async () => {
          try {
            await mkdir(outDir, { recursive: true });
            await writeFile(path, lines.join('\n') + '\n', { encoding: 'utf8' });
          } catch {
            // ignore diagnostics write errors
          }
        })();
      }
    } catch {
      // swallow any diagnostic errors to avoid impacting tests
    }

    entries.push({
      tick: state.ai.tickIndex,
      posture: { ...state.blackboard.teamPosture },
      commands: serializeCommands(state),
      positions: serializePositions(state),
    });

    applyHarnessIntegration(state, tickInterval);
    state.time += tickInterval;
  }

  aggregateKpis(state.ai.metrics, state.ai.tickIndex);
  const log: AIScenarioLog = {
    name: config.name,
    tickInterval,
    seed,
    entries,
    metrics: snapshotMetrics(state.ai.metrics),
  };

  // Optionally dump the normalized JSON log for fixture maintenance.
  // Enable by setting AI_WRITE_SCENARIO_JSON=1 in the environment.
  try {
    const shouldWrite = (() => {
      try {
        const v = (globalThis as any)?.process?.env?.AI_WRITE_SCENARIO_JSON;
        return v === '1' || v === 'true' || v === 'on';
      } catch {
        return false;
      }
    })();
    if (shouldWrite) {
      const outDir = join('.', 'tmp');
      const file = join(outDir, `ai-scenario-${config.name}.json`);
      // Normalize headings/positions for stable diffs similar to test helper
      const normalized: AIScenarioLog = {
        ...log,
        entries: log.entries.map((entry) => ({
          ...entry,
          commands: entry.commands.map((c) => ({
            ...c,
            heading: [
              Number(c.heading[0].toFixed(3)),
              Number(c.heading[1].toFixed(3)),
              Number(c.heading[2].toFixed(3)),
            ] as [number, number, number],
            thrust: Number(c.thrust.toFixed(3)),
          })),
          positions: entry.positions.map((p) => ({
            ...p,
            position: [
              Number(p.position[0].toFixed(3)),
              Number(p.position[1].toFixed(3)),
              Number(p.position[2].toFixed(3)),
            ] as [number, number, number],
          })),
        })),
      };
      // fire-and-forget async write
      void (async () => {
        try {
          await mkdir(outDir, { recursive: true });
          await writeFile(file, JSON.stringify(normalized, null, 2), { encoding: 'utf8' });
        } catch {
          // ignore optional dump errors
        }
      })();
    }
  } catch {
    // ignore optional dump errors
  }

  return log;
}

/**
 * Exported helper function to collect test metrics from an AI scenario log.
 * This can be used by external tools for AI experiment validation.
 */
export function collectTestMetrics(log: AIScenarioLog): {
  timeToFirstShot: { p50: number | null; p90: number | null; samples: number };
  verticalDispersion: { fighterEscortVerticalRatio: number; totalCommands: number };
  inBandTime: { overall: number | null; fighter: number | null; corvette: number | null };
  openingAggression: { ratio: number | null; total: number };
  decisionLatency: { buckets: [number, number, number, number]; total: number };
  focusFire: { samples: number; avg: number | null; max: number | null };
  headingAmplitude: { samples: number; avg: number | null; min: number | null; max: number | null };
  ties: { decisions: number; fallbacks: number; ratio: number | null };
} {
  const metrics = log.metrics;

  // Time-to-first-shot metrics
  const timeToFirstShot = {
    p50: metrics.kpis.firstShot.p50,
    p90: metrics.kpis.firstShot.p90,
    samples: metrics.kpis.firstShot.samples,
  };

  // Vertical dispersion - count commands with |heading.y| > 0.05 for fighters/escorts
  let verticalCommands = 0;
  let totalFighterEscortCommands = 0;
  
  for (const entry of log.entries) {
    for (const command of entry.commands) {
      // Assuming fighters and corvettes act as escorts in these scenarios
      if (command.intent === 'Attack' || command.intent === 'Intercept' || command.intent === 'Kite') {
        totalFighterEscortCommands++;
        if (Math.abs(command.heading[1]) > 0.05) {
          verticalCommands++;
        }
      }
    }
  }
  
  const verticalDispersion = {
    fighterEscortVerticalRatio: totalFighterEscortCommands > 0 ? verticalCommands / totalFighterEscortCommands : 0,
    totalCommands: totalFighterEscortCommands,
  };

  // In-band time metrics
  const inBandTime = {
    overall: metrics.kpis.inBand.overall.ratio,
    fighter: metrics.kpis.inBand.byHull.fighter?.ratio ?? null,
    corvette: metrics.kpis.inBand.byHull.corvette?.ratio ?? null,
  };

  // Opening aggression metrics
  const openingAggression = {
    ratio: metrics.kpis.openingAggression.ratio,
    total: metrics.kpis.openingAggression.total,
  };

  const [latency0, latency1, latency2, latency3] = metrics.kpis.decisionLatency.buckets;
  const decisionLatency = {
    buckets: [latency0, latency1, latency2, latency3] as [number, number, number, number],
    total: metrics.kpis.decisionLatency.total,
  };

  const focusFire = {
    samples: metrics.kpis.focusFire.samples,
    avg: metrics.kpis.focusFire.ratioAvg,
    max: metrics.kpis.focusFire.ratioMax,
  };

  const headingAmplitude = {
    samples: metrics.kpis.headingAmplitude.samples,
    avg: metrics.kpis.headingAmplitude.avg,
    min: metrics.kpis.headingAmplitude.min,
    max: metrics.kpis.headingAmplitude.max,
  };

  const ties = {
    decisions: metrics.kpis.ties.decisions,
    fallbacks: metrics.kpis.ties.fallbacks,
    ratio: metrics.kpis.ties.ratio,
  };

  return {
    timeToFirstShot,
    verticalDispersion,
    inBandTime,
    openingAggression,
    decisionLatency,
    focusFire,
    headingAmplitude,
    ties,
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
  const maxHp = spec.maxHp ?? spec.hp ?? 100;
  const hp = spec.hp ?? maxHp;
  const maxShield = spec.maxShield ?? spec.shield ?? 0;
  const shield = spec.shield ?? maxShield;
  const progression = createProgressionDefaults(hull);
  const subsystems = createSubsystems(maxHp);

  const ai: AIState = {
    profileId,
    intent: 'Attack',
    nextThinkAt: 0,
    cooldowns: { dodgeAt: 0, burstAt: 0 },
    lod: 0,
    traitSeed,
    traits: generateTraitsFromSeed(traitSeed),
    stickinessUntil: 0,
    stickinessHeading: new Vector3(0, 0, 1),
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
      xp: progression.xp,
      level: progression.level,
      xpToNext: progression.xpToNext,
      damageType: progression.damageType,
      captain: progression.captain,
      subsystems,
      armor: progression.armor,
      hp,
      maxHp,
      shield,
      maxShield,
      shieldRegen: 0,
      cooldown: 0,
      fireRate: spec.fireRate ?? 0.8,
      damage: 8,
      projectileSpeed: spec.projectileSpeed ?? 30,
      range: spec.range ?? 260,
      speed: spec.speed ?? 40,
      bulletType: spec.bulletType ?? 'bullet:laser',
      velocity: new Vector3(0, 0, 0),
      angularVelocity: new Vector3(0, 0, 0),
      lateralAcceleration: 0,
      motion: createDefaultMotionStats(),
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
    
    // Handle movement
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

    // Handle shooting
    if (ai.command.firePrimary && ship.ship.cooldown <= 0) {
      // Find target for metrics recording (like the AI system does)
      const targetId = ai.command.targetId ?? ai.targetId;
      const target = targetId 
        ? (state.queries.ships.entities as HarnessShip[]).find(s => s.id === targetId)
        : null;
      
      // Record shot metrics before firing (like executeAICommand does)
      const distanceToTarget = target
        ? ship.transform.position.distanceTo(target.transform.position)
        : undefined;
      const deltaY = target ? target.transform.position.y - ship.transform.position.y : undefined;
      
      recordShotMetrics(state.ai.metrics, {
        shipId: ship.id,
        hull: ship.ship.hull,
        time: state.time,
        distance: distanceToTarget,
        deltaY,
      });
      
      // Fire projectile in the command heading direction
      const fireDirection = heading.clone().normalize();
      fireProjectile(state, ship, fireDirection);
      ship.ship.cooldown = ship.ship.fireRate;
    }

    // Update cooldowns
    if (ship.ship.cooldown > 0) {
      ship.ship.cooldown -= delta;
    }
  }
}

function snapshotMetrics(metrics: AIMetrics): AIScenarioMetrics {
  const firstShotTimes = [...metrics.firstShotTimes];
  const intentTimeline = metrics.intentTimeline.map((entry) => ({
    tick: entry.tick,
    time: entry.time,
    counts: { ...entry.counts },
    total: entry.total,
  }));

  const shotDistance = Object.create(null) as AIScenarioMetrics['shotDistance'];
  const shotDeltaY = Object.create(null) as AIScenarioMetrics['shotDeltaY'];
  for (const hull of SHIP_HULLS) {
    const distanceHist = metrics.shotDistanceHist[hull];
    shotDistance[hull] = {
      buckets: [...distanceHist.buckets],
      counts: [...distanceHist.counts],
      total: distanceHist.total,
    };
    const deltaHist = metrics.shotDeltaYHist[hull];
    shotDeltaY[hull] = {
      buckets: [...deltaHist.buckets],
      counts: [...deltaHist.counts],
      total: deltaHist.total,
    };
  }

  const source = metrics.kpis;
  const inBandByHull = Object.create(null) as AIScenarioMetrics['kpis']['inBand']['byHull'];
  for (const hull of SHIP_HULLS) {
    inBandByHull[hull] = { ...source.inBand.byHull[hull] };
  }

  const kpis: AIKpiSummary = {
    firstShot: { ...source.firstShot },
    openingAggression: { ...source.openingAggression },
    inBand: {
      overall: { ...source.inBand.overall },
      byHull: inBandByHull,
    },
    vertical: { ...source.vertical },
    decisionLatency: {
      buckets: [
        source.decisionLatency.buckets[0],
        source.decisionLatency.buckets[1],
        source.decisionLatency.buckets[2],
        source.decisionLatency.buckets[3],
      ],
      total: source.decisionLatency.total,
    },
    focusFire: { ...source.focusFire },
    headingAmplitude: { ...source.headingAmplitude },
    ties: { ...source.ties },
  };

  return {
    kpis,
    firstShotTimes,
    intentTimeline,
    shotDistance,
    shotDeltaY,
  };
}

