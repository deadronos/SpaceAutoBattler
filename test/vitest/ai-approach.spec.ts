/* eslint-env node, vitest */
// Enable AI debug logs early so DEBUG_AI constant captures it during module init
// Ensure DEBUG_AI is available in test runs via globalThis
/* eslint-env node, vitest */
/* global process */
// Enable AI debug logs early so DEBUG_AI constant captures it during module init
process.env.DEBUG_AI = '1';
import { test, expect } from 'vitest';
import { createInitialState, spawnShip, simulateStep } from '../../src/core/gameState.js';

test('AI approachToRange behavior — ship approaches then fires', () => {
  const state = createInitialState('ai-approach-test');

  state.behaviorConfig!.globalSettings.aiEnabled = true;
  // place ships roughly outside turret range but within approach multiplier
  const red = spawnShip(state, 'red', 'fighter');
  const blue = spawnShip(state, 'blue', 'fighter');
  red.pos = { x: 100, y: 100, z: 100 };
  // position blue just outside the fighter turret range (600) but inside approachMultiplier (600 * 1.2 = 720)
  // place at distance ~650 from red
  blue.pos = { x: 100, y: 100, z: 750 };

  // Ensure approach multiplier is set (test resilience)
  state.behaviorConfig!.globalSettings.approachRangeMultiplier = 1.2;

  let sawApproach = false;
  let bulletsCreated = 0;
  for (let i = 0; i < 360; i++) {
    simulateStep(state, 1 / 60);
    const r = state.ships.find((s) => s.id === red.id)!;
    const intent = r.aiState?.currentIntent ?? 'undefined';
    const dx = blue.pos.x - r.pos.x;
    const dy = blue.pos.y - r.pos.y;
    const dz = blue.pos.z - r.pos.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    // record if we saw approach intent
    if (intent === 'approachToRange') sawApproach = true;
    // accumulate bullets created this tick and then clear them; the test
    // expects bullets over time so we aggregate across many ticks
    bulletsCreated += state.bullets.length;
    if (process.env.DEBUG_AI)
      console.log(
        `tick=${i} intent=${intent} dist=${dist.toFixed(2)} bullets=${state.bullets.length}`,
      );
    // clear bullets list for next tick accounting (simulateStep appends)
    state.bullets = [];
  }

  expect(sawApproach).toBe(true);
  expect(bulletsCreated).toBeGreaterThan(0);
});
