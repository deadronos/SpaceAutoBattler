import { makeInitialState } from '../../../src/entities';
import { srand } from '../../../src/rng';

export function makeDeterministicState(seed = 12345) {
  const s = makeInitialState() as any;
  srand(seed >>> 0);
  return s as any;
}
