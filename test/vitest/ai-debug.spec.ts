/* global process */
import { test } from 'vitest';
import { createInitialState, spawnShip, simulateStep } from '../../src/core/gameState.js';

test('headless AI debug run', () => {
  process.env.DEBUG_AI = '1';
  const state = createInitialState('debug-seed');
  state.behaviorConfig!.globalSettings.aiEnabled = true;

  const red = spawnShip(state, 'red', 'fighter');
  const blue = spawnShip(state, 'blue', 'fighter');
  red.pos = { x: 100, y: 200, z: 200 };
  blue.pos = { x: 300, y: 200, z: 200 };

  // Run a few ticks and log summary info to console (Vitest will capture output)
  for (let i = 0; i < 10; i++) {
    simulateStep(state, 0.1);
    // Logging to console so DEBUG_AI prints can be observed in test output
    console.log(
      `Tick ${i} time=${state.time.toFixed(2)} red.target=${red.targetId} blue.target=${blue.targetId} bullets=${state.bullets.length}`,
    );
  }
});
