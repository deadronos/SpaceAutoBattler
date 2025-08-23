import { test, expect } from 'vitest';

test('getLastReinforcement returns diagnostic after reinforcement trigger', async () => {
  const gmMod = await import('../../src/gamemanager');
  // reset state and set small interval
  gmMod.reset && gmMod.reset(12345);
  gmMod.setReinforcementInterval && gmMod.setReinforcementInterval(0.01);

  // create manager instance with no worker to exercise main-thread fallback
  const gm: any = gmMod.createGameManager({ renderer: null, createSimWorker: () => null });
  // enable continuous fallback
  gm.setContinuousEnabled && gm.setContinuousEnabled(true);

  // step once to trigger reinforcements
  gm.stepOnce && gm.stepOnce(0.02);

  // ask for diagnostics
  const diag = gm.getLastReinforcement && gm.getLastReinforcement();
  expect(diag).toBeDefined();
  expect(diag).toHaveProperty('spawned');
  expect(Array.isArray(diag.spawned)).toBe(true);
  expect(diag.spawned.length).toBeGreaterThan(0);
  expect(diag).toHaveProperty('timestamp');
  expect(typeof diag.timestamp).toBe('number');
  expect(diag).toHaveProperty('options');
});
