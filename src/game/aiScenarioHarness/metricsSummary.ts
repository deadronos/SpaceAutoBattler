import type { AIScenarioLog } from './types.js';

export interface AIScenarioTestMetrics {
  timeToFirstShot: { p50: number | null; p90: number | null; samples: number };
  verticalDispersion: { fighterEscortVerticalRatio: number; totalCommands: number };
  inBandTime: { overall: number | null; fighter: number | null; corvette: number | null };
  openingAggression: { ratio: number | null; total: number };
  decisionLatency: { buckets: [number, number, number, number]; total: number };
  focusFire: { samples: number; avg: number | null; max: number | null };
  headingAmplitude: { samples: number; avg: number | null; min: number | null; max: number | null };
  ties: { decisions: number; fallbacks: number; ratio: number | null };
}

export function collectTestMetrics(log: AIScenarioLog): AIScenarioTestMetrics {
  const metrics = log.metrics;

  const timeToFirstShot = {
    p50: metrics.kpis.firstShot.p50,
    p90: metrics.kpis.firstShot.p90,
    samples: metrics.kpis.firstShot.samples,
  };

  let verticalCommands = 0;
  let totalFighterEscortCommands = 0;

  for (const entry of log.entries) {
    for (const command of entry.commands) {
      if (command.intent === 'Attack' || command.intent === 'Intercept' || command.intent === 'Kite') {
        totalFighterEscortCommands += 1;
        if (Math.abs(command.heading[1]) > 0.05) {
          verticalCommands += 1;
        }
      }
    }
  }

  const verticalDispersion = {
    fighterEscortVerticalRatio:
      totalFighterEscortCommands > 0 ? verticalCommands / totalFighterEscortCommands : 0,
    totalCommands: totalFighterEscortCommands,
  };

  const inBandTime = {
    overall: metrics.kpis.inBand.overall.ratio,
    fighter: metrics.kpis.inBand.byHull.fighter?.ratio ?? null,
    corvette: metrics.kpis.inBand.byHull.corvette?.ratio ?? null,
  };

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
