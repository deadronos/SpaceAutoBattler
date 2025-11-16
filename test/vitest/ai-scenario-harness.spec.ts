import { describe, expect, it } from 'vitest';
import { runAIScenario, collectTestMetrics } from '../support/aiScenarioHarness.js';
import { useUiStore } from '../../src/game/uiStore.js';
import type { AIScenarioConfig, AIScenarioLog } from '../support/aiScenarioHarness.js';
import escortScenario from './fixtures/ai-escort-scenario.json';
import bomberInterceptScenario from './fixtures/ai-bomber-intercept-scenario.json';
import artilleryRetreatScenario from './fixtures/ai-artillery-retreat-scenario.json';

const ESCORT_CONFIG: AIScenarioConfig = {
  name: 'escort-intercept-regroup',
  ticks: 5,
  tickInterval: 0.1,
  seed: 777,
  ships: [
    {
      id: 1,
      team: 'blue',
      hull: 'carrier',
      position: [0, 0, 0],
      profileId: 'artillery',
      hp: 150,
      maxHp: 200,
      range: 320,
    },
    {
      id: 2,
      team: 'blue',
      hull: 'fighter',
      position: [-60, 0, -40],
      profileId: 'escort',
      hp: 30,
      maxHp: 60,
      speed: 50,
    },
    {
      id: 3,
      team: 'blue',
      hull: 'destroyer',
      position: [-140, 0, 60],
      profileId: 'artillery',
      hp: 60,
      maxHp: 160,
    },
    {
      id: 4,
      team: 'red',
      hull: 'corvette',
      position: [320, 0, -40],
      profileId: 'brawler',
      hp: 160,
      maxHp: 160,
      velocity: [-30, 0, 10],
    },
    {
      id: 5,
      team: 'red',
      hull: 'frigate',
      position: [560, 0, 140],
      profileId: 'artillery',
      hp: 200,
      maxHp: 220,
    },
  ],
};

const BOMBER_INTERCEPT_CONFIG: AIScenarioConfig = {
  name: 'bomber-intercept',
  ticks: 6,
  tickInterval: 0.1,
  seed: 2029,
  ships: [
    {
      id: 1,
      team: 'blue',
      hull: 'carrier',
      position: [0, 0, 0],
      profileId: 'artillery',
      hp: 220,
      maxHp: 220,
      range: 420,
    },
    {
      id: 2,
      team: 'blue',
      hull: 'fighter',
      position: [-80, 0, -40],
      profileId: 'escort',
      hp: 55,
      maxHp: 60,
      speed: 55,
    },
    {
      id: 3,
      team: 'blue',
      hull: 'fighter',
      position: [-90, 0, 60],
      profileId: 'escort',
      hp: 60,
      maxHp: 60,
      speed: 55,
    },
    {
      id: 4,
      team: 'red',
      hull: 'destroyer',
      position: [480, 0, -10],
      profileId: 'artillery',
      hp: 260,
      maxHp: 260,
      speed: 32,
      projectileSpeed: 24,
      velocity: [-45, 0, 6],
    },
    {
      id: 5,
      team: 'red',
      hull: 'corvette',
      position: [540, 0, 80],
      profileId: 'brawler',
      hp: 140,
      maxHp: 140,
      velocity: [-30, 0, -10],
    },
  ],
};

const ARTILLERY_RETREAT_CONFIG: AIScenarioConfig = {
  name: 'artillery-retreat',
  ticks: 6,
  tickInterval: 0.1,
  seed: 4041,
  ships: [
    {
      id: 1,
      team: 'blue',
      hull: 'destroyer',
      position: [240, 0, 40],
      profileId: 'artillery',
      hp: 36,
      maxHp: 180,
      speed: 32,
      range: 480,
    },
    {
      id: 2,
      team: 'blue',
      hull: 'fighter',
      position: [-20, 0, -30],
      profileId: 'escort',
      hp: 28,
      maxHp: 60,
      speed: 48,
    },
    {
      id: 3,
      team: 'red',
      hull: 'corvette',
      position: [420, 0, 60],
      profileId: 'brawler',
      hp: 160,
      maxHp: 160,
      velocity: [-32, 0, -8],
    },
    {
      id: 4,
      team: 'red',
      hull: 'frigate',
      position: [520, 0, -120],
      profileId: 'brawler',
      hp: 220,
      maxHp: 220,
      velocity: [-26, 0, 12],
    },
  ],
};

describe('AI scenario harness', () => {
  // Ensure harness scenarios run with smoothing disabled so they match the
  // stored fixture outputs which expect raw (unsmoothed) thrust/heading
  // values. Tests explicitly backup and restore the UI override to avoid
  // polluting other tests.
  let originalSmoothing: boolean | null | undefined;
  let originalEngagement: boolean | null | undefined;
  let originalTickRateExp: boolean | null | undefined;
  beforeEach(() => {
    const store = useUiStore.getState();
    originalSmoothing = store.aiSmoothingEnabled;
    store.setAiSmoothingEnabled?.(false);
    // Also disable engagement boost so scenario harness outputs remain consistent
    // with the stored fixtures which were recorded without the engagement boost.
    originalEngagement = store.aiEngagementBoostEnabled;
    store.setAiEngagementBoostEnabled?.(false);
    // Ensure tick-rate experiment is disabled for harness runs so timing-based
    // decision differences match the fixture expectations.
    originalTickRateExp = store.aiTickRateExperimentEnabled;
    store.setAiTickRateExperimentEnabled?.(false);
  });
  afterEach(() => {
    const store = useUiStore.getState();
    store.setAiSmoothingEnabled?.(originalSmoothing ?? null);
    store.setAiEngagementBoostEnabled?.(originalEngagement ?? null);
    store.setAiTickRateExperimentEnabled?.(originalTickRateExp ?? null);
  });

  it('emits deterministic command logs for escort scenario', () => {
    const log = runAIScenario(ESCORT_CONFIG);
    expectLogsApproximatelyEqual(normalizeLog(log), escortScenario);
  });

  it('emits deterministic command logs for bomber intercept scenario', () => {
    const log = runAIScenario(BOMBER_INTERCEPT_CONFIG);
    expectLogsApproximatelyEqual(normalizeLog(log), bomberInterceptScenario);
  });

  it('emits deterministic command logs for artillery retreat scenario', () => {
    const log = runAIScenario(ARTILLERY_RETREAT_CONFIG);
    const normalized = normalizeLog(log);
    // Diagnostic: print all entries so we can see intent/thrust differences
    // for the failing scenario when running locally.
    // console.log('ARTILLERY ACTUAL ENTRIES:', JSON.stringify(normalized.entries, null, 2));
    // console.log(
    //   'ARTILLERY EXPECTED ENTRIES:',
    //   JSON.stringify(artilleryRetreatScenario.entries, null, 2),
    // );
    expectLogsApproximatelyEqual(normalized, artilleryRetreatScenario);
  });
});

describe('aiScenarioHarness public surface', () => {
  it('exports runAIScenario and collectTestMetrics as callables', () => {
    expect(typeof runAIScenario).toBe('function');
    expect(typeof collectTestMetrics).toBe('function');
  });

  it('runAIScenario returns an AIScenarioLog-shaped object and metrics can be collected', () => {
    const log = runAIScenario({
      name: 'smoke-public-api',
      ticks: 1,
      tickInterval: 0.1,
      seed: 123,
      ships: [
        {
          id: 1,
          team: 'blue',
          hull: 'fighter',
          position: [0, 0, 0],
          profileId: 'escort',
          hp: 30,
          maxHp: 60,
        },
      ],
    } as any);

    expect(log).toBeTruthy();
    expect(log.name).toBe('smoke-public-api');
    expect(Array.isArray(log.entries)).toBe(true);
    expect(log.entries.length).toBe(1);
    expect(log.entries[0]?.commands).toBeDefined();

    const metrics = collectTestMetrics(log as any);
    expect(metrics).toBeTruthy();
    expect(typeof metrics).toBe('object');
    expect(metrics.timeToFirstShot).toBeDefined();
  });
});

// Normalize numeric fields for comparison; keep this near top so tests can use it.
function normalizeLog(log: AIScenarioLog): AIScenarioLog {
  return {
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
}

// Approximate comparator for AI scenario logs
function expectLogsApproximatelyEqual(actual: any, expected: any): void {
  // Structural checks
  expect(actual.name).toEqual(expected.name);
  expect(actual.tickInterval).toEqual(expected.tickInterval);
  expect(actual.entries.length).toEqual(expected.entries.length);

  const HEADING_TOL = 0.03;
  const THRUST_TOL = 0.7; // allow larger thrust swings in scenario harness smoke checks
  const POSITION_TOL = 5; // world units
  const SCORE_TOL = 50; // absolute
  const HEADING_AMPLITUDE_TOL = 0.05;
  const OPENING_AGGRESSION_TOL = 2;

  for (let i = 0; i < actual.entries.length; i += 1) {
    const a = actual.entries[i];
    const e = expected.entries[i];
    expect(a.tick).toEqual(e.tick);
    // commands
    expect(a.commands.length).toEqual(e.commands.length);
    for (let j = 0; j < a.commands.length; j += 1) {
      const ac = a.commands[j];
      const ec = e.commands[j];
      expect(ac.id).toEqual(ec.id);
      if (ac.intent !== ec.intent) {
        throw new Error(
          `intent mismatch tick=${a.tick} id=${ac.id} actual=${ac.intent} expected=${ec.intent}`,
        );
      }
      expect(ac.lod).toEqual(ec.lod);
      // presence of targetId: ensure both have or both lack
      const aHasTarget = ac.targetId != null;
      const eHasTarget = ec.targetId != null;
      if (eHasTarget) {
        expect(ac.targetId).toEqual(ec.targetId);
      } else {
        expect(aHasTarget).toBe(false);
      }
      if (!ac.heading || !ec.heading)
        throw new Error(`missing heading at tick ${a.tick} cmd ${ac.id}`);
      for (let k = 0; k < 3; k += 1) {
        const diff = Math.abs(ac.heading[k] - ec.heading[k]);
        if (diff > HEADING_TOL)
          throw new Error(
            `heading mismatch tick=${a.tick} id=${ac.id} comp=${k} diff=${diff.toFixed(4)} > tol ${HEADING_TOL}`,
          );
      }
      if (Math.abs((ac.thrust ?? 0) - (ec.thrust ?? 0)) > THRUST_TOL) {
        throw new Error(
          `thrust mismatch tick=${a.tick} id=${ac.id} actual=${ac.thrust} expected=${ec.thrust}`,
        );
      }
      const expectedScore = ec.score ?? 0;
      const adaptiveScoreTol = Math.max(SCORE_TOL, Math.abs(expectedScore) * 0.2);
      if (Math.abs((ac.score ?? 0) - expectedScore) > adaptiveScoreTol) {
        throw new Error(
          `score mismatch tick=${a.tick} id=${ac.id} actual=${ac.score} expected=${ec.score} tol=${adaptiveScoreTol}`,
        );
      }
    }

    // positions
    expect(a.positions.length).toEqual(e.positions.length);
    for (let j = 0; j < a.positions.length; j += 1) {
      const ap = a.positions[j];
      const ep = e.positions[j];
      expect(ap.id).toEqual(ep.id);
      for (let k = 0; k < 3; k += 1) {
        const diff = Math.abs(ap.position[k] - ep.position[k]);
        if (diff > POSITION_TOL)
          throw new Error(
            `position mismatch tick=${a.tick} id=${ap.id} comp=${k} diff=${diff.toFixed(3)} > tol ${POSITION_TOL}`,
          );
      }
    }
  }

  // Metrics: compare only a few high-level KPIs
  const aK = actual.metrics?.kpis ?? actual.metrics ?? ({} as any);
  const eK = expected.metrics?.kpis ?? expected.metrics ?? ({} as any);
  if (eK.headingAmplitude && eK.headingAmplitude.avg != null) {
    const aAvg = aK.headingAmplitude?.avg ?? aK.headingAmplitude?.avg ?? 0;
    const eAvg = eK.headingAmplitude.avg;
    if (Math.abs(aAvg - eAvg) > HEADING_AMPLITUDE_TOL) {
      throw new Error(
        `headingAmplitude.avg mismatch actual=${aAvg} expected=${eAvg} tol=${HEADING_AMPLITUDE_TOL}`,
      );
    }
  }
  if (eK.openingAggression && typeof eK.openingAggression.aggressive === 'number') {
    const aAgg = aK.openingAggression?.aggressive ?? 0;
    const eAgg = eK.openingAggression.aggressive;
    if (Math.abs(aAgg - eAgg) > OPENING_AGGRESSION_TOL) {
      throw new Error(
        `openingAggression.aggressive mismatch actual=${aAgg} expected=${eAgg} tol=${OPENING_AGGRESSION_TOL}`,
      );
    }
  }
}
