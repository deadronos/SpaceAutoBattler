import { describe, it, expect, vi, beforeEach } from 'vite-plus/test';
import { Vector3 } from 'three';
import { createGameState } from '../../src/game/state.js';
import { spawnShip } from '../../src/game/ships.js';
import * as errors from '../../src/game/errors.js';
import { ensureAiEnabled, handleMissingAi } from '../../src/game/systems/shipControl/aiSafety.js';
import type { GameState, ShipEntity } from '../../src/types/index.js';

// Warning de-duplication must be scoped to a GameState: ship ids restart on a new game, so
// module-level tracking would silence warnings for (and leak memory across) later games.
describe('aiSafety warning de-duplication', () => {
  let reportSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    reportSpy = vi.spyOn(errors, 'reportRecoverableGameError').mockImplementation(() => {});
    return () => reportSpy.mockRestore();
  });

  async function stateWithShip(): Promise<{ state: GameState; ship: ShipEntity }> {
    const state = await createGameState();
    const ship = spawnShip(state, {
      hull: 'corvette',
      team: 'blue',
      position: new Vector3(0, 0, 0),
      heading: 0,
    });
    return { state, ship };
  }

  function reportsWithCode(code: string): number {
    return reportSpy.mock.calls.filter(
      (call: unknown[]) => (call[2] as { code?: string } | undefined)?.code === code,
    ).length;
  }

  it('reports a missing AI component once per ship per game state', async () => {
    const first = await stateWithShip();
    handleMissingAi(first.state, first.ship);
    handleMissingAi(first.state, first.ship);
    expect(reportsWithCode('missing-ai-component')).toBe(1);

    const second = await stateWithShip();
    expect(second.ship.id).toBe(first.ship.id);
    handleMissingAi(second.state, second.ship);
    expect(reportsWithCode('missing-ai-component')).toBe(2);
  });

  it('reports the forced AI enable once per game state', async () => {
    const { state: a } = await stateWithShip();
    ensureAiEnabled(a);
    ensureAiEnabled(a);
    expect(reportsWithCode('ai-force-enable')).toBe(1);

    const { state: b } = await stateWithShip();
    ensureAiEnabled(b);
    expect(reportsWithCode('ai-force-enable')).toBe(2);
  });
});
