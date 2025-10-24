import type { Vector3 } from 'three';
import type {
  AIIntent,
  AIIntentSnapshot,
  AIKpiSummary,
  GameState,
  ShipEntity,
  ShipHull,
  Team,
  TeamPosture,
} from '../../types/index.js';

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

export type HarnessShip = ShipEntity & { __harnessVelocity?: Vector3 };

export type HarnessQueries = {
  ships: { entities: HarnessShip[] };
  projectiles: { entities: never[] };
  turrets: { entities: never[] };
};

export type HarnessGameState = GameState & { queries: HarnessQueries };
