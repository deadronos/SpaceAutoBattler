import { describe, expect, it } from 'vitest';
import { runAIScenario } from '../../src/game/aiScenarioHarness.js';
import type { AIScenarioConfig, AIScenarioLog } from '../../src/game/aiScenarioHarness.js';
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
  it('emits deterministic command logs for escort scenario', () => {
    const log = runAIScenario(ESCORT_CONFIG);
    expect(normalizeLog(log)).toEqual(escortScenario);
  });

  it('emits deterministic command logs for bomber intercept scenario', () => {
    const log = runAIScenario(BOMBER_INTERCEPT_CONFIG);
    expect(normalizeLog(log)).toEqual(bomberInterceptScenario);
  });

  it('emits deterministic command logs for artillery retreat scenario', () => {
    const log = runAIScenario(ARTILLERY_RETREAT_CONFIG);
    expect(normalizeLog(log)).toEqual(artilleryRetreatScenario);
  });
});

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
