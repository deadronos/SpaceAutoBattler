import { describe, test, expect, beforeEach } from 'vitest';
import TintedHullPool from '../../src/pools/tintedHullPool';
describe('TintedHullPool shared-canvas detection', () => {
    beforeEach(() => {
        // Ensure global flag is enabled for the test environment
        globalThis.THROW_ON_SHARED_TINT = '1';
    });
    test('throws when same canvas instance used for different keys if flag set', () => {
        const pool = new TintedHullPool({ globalCap: 10, perTeamCap: 5 });
        const c = document.createElement('canvas');
        c.width = c.height = 8;
        pool.set('a::#111', c);
        expect(() => pool.set('b::#111', c)).toThrow();
    });
});
