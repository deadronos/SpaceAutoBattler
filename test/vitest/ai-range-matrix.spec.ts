/* global process */
import { test } from 'vitest';
import { createInitialState, spawnShip, simulateStep } from '../../src/core/gameState.js';

test('AI engagement vs distance matrix', () => {
  process.env.DEBUG_AI = '1';
  const distances = [100, 200, 300, 350, 500];
  for (const d of distances) {
    const state = createInitialState(`debug-seed-${d}`);
    state.behaviorConfig!.globalSettings.aiEnabled = true;
    const red = spawnShip(state, 'red', 'fighter');
    const blue = spawnShip(state, 'blue', 'fighter');
    red.pos = { x: 100, y: 200, z: 200 };
    blue.pos = { x: 100 + d, y: 200, z: 200 };

    // Run a few ticks
    let bulletsBefore = state.bullets.length;
    for (let i = 0; i < 12; i++) {
      simulateStep(state, 0.1);
    }
    const bulletsAfter = state.bullets.length;
    console.log(
      `distance=${d} bulletsCreated=${bulletsAfter - bulletsBefore} red.target=${red.targetId} blue.target=${blue.targetId}`,
    );
  }
});
