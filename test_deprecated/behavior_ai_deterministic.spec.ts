import { test, expect } from 'vitest';
import { srand } from '../../src/rng';
import { applySimpleAI, getShipAiState } from '../../src/behavior';
import { makeInitialState, createShip } from '../../src/entities';

test('AI state is deterministic under seed', () => {
  srand(12345);
  const state = makeInitialState();
  // create two ships on opposing teams
  const a = createShip('fighter', 100, 100, 'red');
  const b = createShip('fighter', 300, 100, 'blue');
  state.ships.push(a); state.ships.push(b);

  // run a few frames
  applySimpleAI(state, 0.1);
  applySimpleAI(state, 0.1);

  const aiA = getShipAiState(a);
  const aiB = getShipAiState(b);

  expect(aiA).toBeDefined();
  expect(aiB).toBeDefined();
  expect(aiA).toHaveProperty('state');
  expect(aiA).toHaveProperty('decisionTimer');
  expect(typeof aiA.decisionTimer).toBe('number');

  // reseed and simulate again to assert same decisions
  srand(12345);
  const state2 = makeInitialState();
  const a2 = createShip('fighter', 100, 100, 'red');
  const b2 = createShip('fighter', 300, 100, 'blue');
  state2.ships.push(a2); state2.ships.push(b2);
  applySimpleAI(state2, 0.1);
  applySimpleAI(state2, 0.1);
  const aiA2 = getShipAiState(a2);
  const aiB2 = getShipAiState(b2);

  expect(aiA2).toEqual(aiA);
  expect(aiB2).toEqual(aiB);
});
