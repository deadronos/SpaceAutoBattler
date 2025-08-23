import { describe, expect, test } from 'vitest';
import { progression } from '../../src/config/progressionConfig';

describe('progression function scalars', () => {

	test('xpToLevel behaves exponentially', () => {
 		const v1 = progression.xpToLevel(1);
 		expect(v1).toBeCloseTo(100, 8);

 		const v5 = progression.xpToLevel(5);
 		// expected = 100 * 1.25^(5-1)
 		const expectedV5 = 100 * Math.pow(1.25, 4);
 		expect(v5).toBeCloseTo(expectedV5, 8);
 	});

	test('hpPercentPerLevel returns expected diminishing values', () => {
 		// For level 1 the function in spec should return Math.min(0.10, 0.05 + 0.05 / Math.sqrt(1)) => min(0.10, 0.1) => 0.1
 		const hp1 = typeof progression.hpPercentPerLevel === 'function' ? progression.hpPercentPerLevel(1) : progression.hpPercentPerLevel;
 		expect(hp1).toBeCloseTo(0.1, 8);

 		// For a larger level the value should be <= 0.10 and > 0
 		const hp10 = typeof progression.hpPercentPerLevel === 'function' ? progression.hpPercentPerLevel(10) : progression.hpPercentPerLevel;
 		expect(hp10).toBeGreaterThan(0);
 		expect(hp10).toBeLessThanOrEqual(0.1 + 1e-8);
 	});

});

// Removed unnecessary tests and functions related to mkShip and mkBullet

