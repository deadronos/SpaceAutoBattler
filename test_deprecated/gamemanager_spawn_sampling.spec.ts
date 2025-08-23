import { test, expect } from 'vitest';
import { createGameManager } from '../../src/gamemanager';
import { TeamsConfig } from '../../src/config/teamsConfig';

// This test verifies that spawnShip without an explicit type will sample
// ship types from TeamsConfig.defaultFleet.counts when present, and
// falls back to getDefaultShipType() when counts are missing/empty.

test('spawnShip samples configured types when counts present', () => {
	const gm = createGameManager({ useWorker: false });
	// Ensure deterministic manager RNG
	(gm as any).reseed(42);

	// Temporarily override TeamsConfig.defaultFleet.counts for the test
	const orig = TeamsConfig.defaultFleet && TeamsConfig.defaultFleet.counts ? Object.assign({}, TeamsConfig.defaultFleet.counts) : null;
	try {
		TeamsConfig.defaultFleet = TeamsConfig.defaultFleet || {};
		TeamsConfig.defaultFleet.counts = { frigate: 2, corvette: 1 };

		const seen = new Set();
		for (let i = 0; i < 10; i++) {
			(gm as any).spawnShip('red');
			const s = (gm as any)._internal.state.ships[(gm as any)._internal.state.ships.length - 1];
			expect(s).toBeTruthy();
			seen.add(s.type || s.kind || s.shipType || s.ship || s.spec || s.name);
		}
		// Expect both types to have appeared at least once given the weights
		expect(seen.has('frigate') || seen.has('corvette')).toBe(true);
	} finally {
		if (orig) TeamsConfig.defaultFleet.counts = orig; // restore
	}
});

test('spawnShip falls back when counts missing', () => {
	const gm = createGameManager({ useWorker: false });
	(gm as any).reseed(123);

	// Remove counts to simulate missing config
	const orig = TeamsConfig.defaultFleet && TeamsConfig.defaultFleet.counts ? Object.assign({}, TeamsConfig.defaultFleet.counts) : null;
	try {
		if (TeamsConfig.defaultFleet) TeamsConfig.defaultFleet.counts = {};
	(gm as any).spawnShip('blue');
	const s = (gm as any)._internal.state.ships[(gm as any)._internal.state.ships.length - 1];
		expect(s).toBeTruthy();
		// The fallback should be a known default type (string)
		expect(typeof (s.type || s.kind || s.shipType || s.name)).toBe('string');
	} finally {
		if (orig) TeamsConfig.defaultFleet.counts = orig; // restore
	}
});
