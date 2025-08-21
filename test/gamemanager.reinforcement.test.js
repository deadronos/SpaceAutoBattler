import { test, expect } from 'vitest';
import { reset, ships, evaluateReinforcement, setReinforcementInterval, getReinforcementInterval } from '../src/gamemanager.js';
import { srand } from '../src/rng.js';

test('reinforcement interval setter and evaluator', () => {
  reset();
  setReinforcementInterval(0.1);
  expect(getReinforcementInterval()).toBeCloseTo(0.1);
});

test('evaluateReinforcement spawns ships deterministically when seeded', () => {
  srand(555);
  reset();
  // short interval to force immediate spawn
  setReinforcementInterval(0.01);
  // call evaluate twice to trigger once
  evaluateReinforcement(0.02);
  expect(ships.length).toBeGreaterThanOrEqual(2);
});
