#!/usr/bin/env node
import { createGameManager } from '../src/gamemanager.js';

async function main() {
  console.log('Reproducer: create manager (no worker)');
  const { gm } = createGameManager({ useWorker: false });

  console.log('Initial interval (gm.getReinforcementInterval):', gm.getReinforcementInterval && gm.getReinforcementInterval());
  console.log('Enabling continuous mode and setting interval to 1.0s');
  gm.setContinuousEnabled(true);
  gm.setReinforcementInterval(1.0);
  console.log('After set, interval:', gm.getReinforcementInterval && gm.getReinforcementInterval());

  let prev = gm.getLastReinforcement && gm.getLastReinforcement();
  console.log('Initial lastReinforcement timestamp:', prev && prev.timestamp);

  // perform 20 small steps and log whether reinforcements were emitted
  const dt = 0.016; // 16ms ~ 60Hz
  for (let i = 0; i < 20; i++) {
    gm.stepOnce(dt);
    const lr = gm.getLastReinforcement && gm.getLastReinforcement();
    const happened = lr && lr.timestamp && (!prev || (lr.timestamp !== prev.timestamp));
    console.log(`step ${i + 1}: reinforcement happened? ${happened} (last ts: ${lr && lr.timestamp})`);
    prev = lr;
  }

  console.log('Now lowering interval to 0.01s to see frequent reinforcements');
  gm.setReinforcementInterval(0.01);
  prev = gm.getLastReinforcement && gm.getLastReinforcement();
  for (let i = 0; i < 10; i++) {
    gm.stepOnce(dt);
    const lr = gm.getLastReinforcement && gm.getLastReinforcement();
    const happened = lr && lr.timestamp && (!prev || (lr.timestamp !== prev.timestamp));
    console.log(`fast-step ${i + 1}: reinforcement happened? ${happened} (last ts: ${lr && lr.timestamp})`);
    prev = lr;
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
