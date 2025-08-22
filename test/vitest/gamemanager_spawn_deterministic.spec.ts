import { test, expect } from 'vitest';
import { srand, srandom } from '../../src/rng';
import { createGameManager } from '../../src/gamemanager';

test('spawnShip is deterministic when seeded', () => {
	const gm = createGameManager();
	// reseed, compute expected rands using the same manager-local LCG used in gamemanager
	const seed = 12345;
	gm.reseed(seed);
	let st = (seed >>> 0) || 1;
	function next() { st = (Math.imul(1664525, st) + 1013904223) >>> 0; return st; }
	const e1 = next() / 4294967296; const e2 = next() / 4294967296;
	const expectedX = e1 * gm._internal.bounds.W; const expectedY = e2 * gm._internal.bounds.H;

	// reseed again and spawn; should match expected
	gm.reseed(12345);
	// debug: check internal before spawn
	// eslint-disable-next-line no-console
	console.log('internal before spawn:', gm._internal);
	gm.spawnShip('red');
	// debug: check internal after spawn
	// eslint-disable-next-line no-console
	console.log('internal after spawn:', gm._internal);
	const s = gm._internal.state.ships[gm._internal.state.ships.length - 1];
	const recorded = gm._internal.lastSpawnRands;

	// ensure the manager recorded the same random numbers
	expect(recorded[0]).toBeCloseTo(e1, 12);
	expect(recorded[1]).toBeCloseTo(e2, 12);

	expect(s.x).toBeCloseTo(expectedX, 8);
	expect(s.y).toBeCloseTo(expectedY, 8);
});
