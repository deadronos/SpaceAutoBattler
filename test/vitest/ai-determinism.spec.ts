import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { createGameState, disposeGameState } from '../../src/game/state.js';
import { spawnShip } from '../../src/game/ships.js';
import { updateGame } from '../../src/game/systems.js';
import type { GameState, ShipEntity } from '../../src/types/index.js';

const TICKS = 40;

async function buildState(): Promise<GameState> {
  const state = await createGameState();
  state.ai.enabled = true;
  state.ai.tickInterval = 0.1;
  state.ai.maxPerTick = 12;
  setupScenario(state);
  return state;
}

function setupScenario(state: GameState): void {
  const spacing = 160;
  for (let i = 0; i < 3; i += 1) {
    spawnShip(state, {
      hull: 'fighter',
      team: 'blue',
      position: new Vector3(-200 + i * spacing, 0, -80 + i * 40),
      heading: 0,
    });
    spawnShip(state, {
      hull: 'fighter',
      team: 'red',
      position: new Vector3(200 - i * spacing, 0, 80 - i * 40),
      heading: Math.PI,
    });
  }
}

function snapshotCommands(state: GameState): Array<{
  id: number;
  intent: string;
  thrust: number;
  heading: [number, number, number];
  target: number | null;
}> {
  const ships = [...(state.queries.ships.entities as ShipEntity[])].filter((s) => s.ai);
  ships.sort((a, b) => a.id - b.id);
  return ships.map((ship) => ({
    id: ship.id,
    intent: ship.ai!.intent,
    thrust: Number(ship.ai!.command.thrust.toFixed(3)),
    heading: [
      Number(ship.ai!.command.heading.x.toFixed(3)),
      Number(ship.ai!.command.heading.y.toFixed(3)),
      Number(ship.ai!.command.heading.z.toFixed(3)),
    ],
    target: ship.ai!.command.targetId ?? ship.ai!.targetId ?? null,
  }));
}

describe('AI determinism', () => {
  it('produces identical command streams for identical seeds', async () => {
    const first = await buildState();
    const second = await buildState();

    const firstHistory: ReturnType<typeof snapshotCommands>[] = [];
    const secondHistory: ReturnType<typeof snapshotCommands>[] = [];
    const dt = first.ai.tickInterval;

    for (let tick = 0; tick < TICKS; tick += 1) {
      updateGame(first, dt);
      updateGame(second, dt);
      firstHistory.push(snapshotCommands(first));
      secondHistory.push(snapshotCommands(second));
    }

    try {
      expect(firstHistory).toEqual(secondHistory);
    } finally {
      disposeGameState(first);
      disposeGameState(second);
    }
  }, 120000);
});
