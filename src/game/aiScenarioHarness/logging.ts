import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import type { Vector3 } from 'three';
import type { AIMetrics } from '../../types/index.js';
import { SHIP_HULLS } from '../metrics.js';
import type {
  AIScenarioCommandLog,
  AIScenarioLog,
  AIScenarioMetrics,
  AIScenarioPositionLog,
  HarnessGameState,
  HarnessShip,
} from './types.js';

type EnvSource = { process?: { env?: Record<string, string | undefined> } };

export function serializeCommands(state: HarnessGameState): AIScenarioCommandLog[] {
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

export function serializePositions(state: HarnessGameState): AIScenarioPositionLog[] {
  const ships = state.queries.ships.entities as HarnessShip[];
  return ships
    .map((ship) => ({
      id: ship.id,
      position: normalizeForLog(ship.transform.position),
    }))
    .sort((a, b) => a.id - b.id);
}

export function snapshotMetrics(metrics: AIMetrics): AIScenarioMetrics {
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

  const kpis = {
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
  } satisfies AIScenarioMetrics['kpis'];

  return {
    kpis,
    firstShotTimes,
    intentTimeline,
    shotDistance,
    shotDeltaY,
  };
}

export function maybeWriteScenarioJson(log: AIScenarioLog, scenarioName: string): void {
  try {
    const shouldWrite = (() => {
      try {
        const envSource = globalThis as EnvSource;
        const value = envSource.process?.env?.AI_WRITE_SCENARIO_JSON;
        return value === '1' || value === 'true' || value === 'on';
      } catch {
        return false;
      }
    })();

    if (!shouldWrite) {
      return;
    }

    const outDir = join('.', 'tmp');
    const file = join(outDir, `ai-scenario-${scenarioName}.json`);
    const normalized: AIScenarioLog = {
      ...log,
      entries: log.entries.map((entry) => ({
        ...entry,
        commands: entry.commands.map((command) => ({
          ...command,
          heading: [
            Number(command.heading[0].toFixed(3)),
            Number(command.heading[1].toFixed(3)),
            Number(command.heading[2].toFixed(3)),
          ] as [number, number, number],
          thrust: Number(command.thrust.toFixed(3)),
        })),
        positions: entry.positions.map((position) => ({
          ...position,
          position: [
            Number(position.position[0].toFixed(3)),
            Number(position.position[1].toFixed(3)),
            Number(position.position[2].toFixed(3)),
          ] as [number, number, number],
        })),
      })),
    };

    void (async () => {
      try {
        await mkdir(outDir, { recursive: true });
        await writeFile(file, JSON.stringify(normalized, null, 2), { encoding: 'utf8' });
      } catch {
        // ignore optional dump errors
      }
    })();
  } catch {
    // ignore optional dump errors
  }
}

function normalizeForLog(vec: Vector3): readonly [number, number, number] {
  return [clampNumber(vec.x, 3), clampNumber(vec.y, 3), clampNumber(vec.z, 3)] as const;
}

function clampNumber(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
