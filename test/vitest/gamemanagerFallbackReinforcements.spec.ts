import { test, expect } from 'vitest';

test('main-thread fallback emits reinforcements when continuous and team under threshold', async () => {
  const { createGameManager } = await import('../../src/gamemanager');
  const gm: any = createGameManager({ renderer: null, createSimWorker: () => { throw new Error('no worker'); } });

  let captured: any = null;
  gm.on('reinforcements', (m: any) => { captured = m; });

  // ensure deterministic RNG for test
  const { srand } = await import('../../src/rng');
  srand(42);

  // set continuous mode and short interval
  gm.setReinforcementInterval(0.01);
  gm.setContinuousEnabled(true);

  // make blue team dominant by creating 4 blue ships and 0 red ships
  gm._internal.state.ships = [];
  for (let i = 0; i < 4; i++) gm._internal.state.ships.push({ id: 1000 + i, type: 'fighter', team: 'blue' });

  // step once to trigger reinforcements for red
  gm.stepOnce(0.02);

  expect(captured).not.toBeNull();
  expect(Array.isArray(captured.spawned)).toBe(true);
  expect(captured.spawned.length).toBeGreaterThanOrEqual(1);
  // spawned types should be valid according to ship config
  const { getShipConfig } = await import('../../src/config/entitiesConfig');
  const validTypes = Object.keys(getShipConfig());
  for (const s of captured.spawned) {
    expect(validTypes.includes(s.type)).toBe(true);
  }
});
