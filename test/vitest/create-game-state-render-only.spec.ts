import { describe, expect, it, vi, beforeEach } from 'vite-plus/test';

const { rapierInitMock, rapierWorldMock, rapierEventQueueMock } = vi.hoisted(() => ({
  rapierInitMock: vi.fn(async () => {}),
  rapierWorldMock: vi.fn(function MockWorld(this: { integrationParameters: { dt: number } }) {
    this.integrationParameters = { dt: 0 };
  } as unknown as () => void),
  rapierEventQueueMock: vi.fn(function MockEventQueue(
    this: Record<string, never>,
  ) {} as unknown as () => void),
}));

vi.mock('@dimforge/rapier3d-compat', () => ({
  default: {
    init: rapierInitMock,
    World: rapierWorldMock,
    EventQueue: rapierEventQueueMock,
  },
}));

import { createGameState } from '../../src/game/createGameState.js';

describe('createGameState render-only option', () => {
  beforeEach(() => {
    rapierInitMock.mockClear();
    rapierWorldMock.mockClear();
    rapierEventQueueMock.mockClear();
  });

  it('skips Rapier bootstrap in render-only mode', async () => {
    const state = await createGameState({ renderOnly: true });

    expect(rapierInitMock).not.toHaveBeenCalled();
    expect(rapierWorldMock).not.toHaveBeenCalled();
    expect(rapierEventQueueMock).not.toHaveBeenCalled();
    expect(state.queries.ships.entities).toHaveLength(0);
    expect(state.simulation.lastTickIndex).toBe(0);
  });

  it('keeps full Rapier bootstrap by default', async () => {
    await createGameState();

    expect(rapierInitMock).toHaveBeenCalledTimes(1);
    expect(rapierWorldMock).toHaveBeenCalledTimes(1);
    expect(rapierEventQueueMock).toHaveBeenCalledTimes(1);
  });
});
