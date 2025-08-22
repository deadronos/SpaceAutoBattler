import { test, expect } from 'vitest';

// Verify TypeScript gamemanager emits manager-level 'reinforcements' events
// when evaluateReinforcement triggers and that listeners registered via
// createGameManager().on receive the message.
test('TS manager emits reinforcements and gm.on receives them', async () => {
  // Import the TypeScript module directly so we exercise the TS implementation
  const gmMod = await import('../../src/gamemanager.js');

  // ensure clean start
  if (typeof gmMod.reset === 'function') gmMod.reset(12345);
  // make reinforcement interval tiny for quick triggering
  if (typeof gmMod.setReinforcementInterval === 'function') gmMod.setReinforcementInterval(0.01);

  // create an instance — force main-thread sim by passing a factory that returns null
  const gm: any = gmMod.createGameManager({ renderer: null, createSimWorker: () => null });

  const received: any[] = [];
  gm.on && gm.on('reinforcements', (m: any) => { received.push(m); });

  // enable continuous fallback and make reinforcement interval tiny
  gm.setContinuousEnabled && gm.setContinuousEnabled(true);
  gm.setReinforcementInterval && gm.setReinforcementInterval(0.01);

  // Step once with dt >= interval to trigger reinforcement logic
  gm.stepOnce && gm.stepOnce(0.02);

  // Allow any synchronous emissions to be observed
  await Promise.resolve();

  expect(received.length).toBeGreaterThan(0);
  const msg = received[0];
  expect(msg).toHaveProperty('spawned');
  expect(Array.isArray(msg.spawned)).toBe(true);
  expect(msg.spawned.length).toBeGreaterThan(0);
  // basic shape checks
  for (const s of msg.spawned) {
    expect(s).toHaveProperty('type');
    expect(s).toHaveProperty('team');
  }
});
