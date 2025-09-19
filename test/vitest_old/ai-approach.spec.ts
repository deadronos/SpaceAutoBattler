/* eslint-env node, vitest */
/* global process */
// Keep AI debug logs disabled by default for performance; developers can opt-in
// by setting VITEST_AI_DEBUG=1 when running tests.
if (typeof process.env.DEBUG_AI === 'undefined') process.env.DEBUG_AI = process.env.VITEST_AI_DEBUG === '1' ? '1' : '0';
import { test, expect } from 'vitest';
import { createInitialState, spawnShip, simulateStep } from '../../src/core/gameState.js';
import { getTurretConfig } from '../../src/config/entitiesConfig.js';

test('AI approachToRange behavior — ship approaches then fires', { timeout: 60000 }, () => {
  const state = createInitialState('ai-approach-test');

  state.behaviorConfig!.globalSettings.aiEnabled = true;
  // place ships roughly outside turret range but within approach multiplier
  const red = spawnShip(state, 'red', 'fighter');
  const blue = spawnShip(state, 'blue', 'fighter');
  red.pos = { x: 100, y: 100, z: 100 };

  // Dynamically compute fighter turret range so test is resilient to config changes
  const fighterTurret = getTurretConfig('fighter-cannon');
  const fighterRange = fighterTurret ? fighterTurret.range : 600;

  // Ensure approach multiplier is set (test resilience)
  const approachMultiplier = 1.2;
  state.behaviorConfig!.globalSettings.approachRangeMultiplier = approachMultiplier;

  // position blue just outside the fighter turret range but inside the approach multiplier
  // choose distance at ~range * 1.1 (between range and range * approachMultiplier)
  const desiredDist = Math.floor(fighterRange * 1.1);
  // place along Z so distance from red at 100,100,100 equals desiredDist
  blue.pos = { x: 100, y: 100, z: 100 + desiredDist };

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
    if (process.env.DEBUG_AI === '1')
      console.log(
        `tick=${i} intent=${intent} dist=${dist.toFixed(2)} bullets=${state.bullets.length}`,
      );
    // clear bullets list for next tick accounting (simulateStep appends)
    state.bullets = [];
  }

  expect(sawApproach).toBe(true);
  expect(bulletsCreated).toBeGreaterThan(0);
});
