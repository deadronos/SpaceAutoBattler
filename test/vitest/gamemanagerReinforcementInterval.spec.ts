import { test, expect } from 'vitest';

test('reinforcements respect configured interval (not every step)', async () => {
  const gmMod = await import('../../src/gamemanager.js');
  // reset global/module state
  if (typeof gmMod.reset === 'function') gmMod.reset(12345);

  const gm: any = gmMod.createGameManager({ renderer: null, createSimWorker: () => null });
  const seen: number[] = [];
  // enable continuous fallback reinforcements
  gm.setContinuousEnabled && gm.setContinuousEnabled(true);
  gm.setReinforcementInterval && gm.setReinforcementInterval(1.0);

  let prev = gm.getLastReinforcement && gm.getLastReinforcement();
  // perform 20 steps (20 * 0.016 = 0.32s) which is less than interval => expect no reinforcements
  for (let i = 0; i < 20; i++) {
    gm.stepOnce && gm.stepOnce(0.016);
    const lr = gm.getLastReinforcement && gm.getLastReinforcement();
    if (lr && lr.timestamp && (!prev || lr.timestamp !== prev.timestamp)) seen.push(lr.timestamp);
    prev = lr;
  }
  expect(seen.length).toBe(0);

  // now set a small per-manager interval and ensure reinforcements occur quickly
  gm.setReinforcementInterval && gm.setReinforcementInterval(0.01);
  prev = gm.getLastReinforcement && gm.getLastReinforcement();
  let fastSeen = 0;
  for (let i = 0; i < 10; i++) {
    gm.stepOnce && gm.stepOnce(0.016);
    const lr = gm.getLastReinforcement && gm.getLastReinforcement();
    if (lr && lr.timestamp && (!prev || lr.timestamp !== prev.timestamp)) fastSeen++;
    prev = lr;
  }
  expect(fastSeen).toBeGreaterThan(0);
});
