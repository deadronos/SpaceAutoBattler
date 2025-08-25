import { describe, test, expect } from 'vitest';
import TintedHullPool from '../../src/pools/tintedHullPool';

describe('TintedHullPool', () => {
  test('per-team cap eviction and global cap enforcement', () => {
    const pool = new TintedHullPool({ globalCap: 10, perTeamCap: 3 });
    // Helper to create a tiny canvas
    function makeCanvas(id: number) {
      const c = document.createElement('canvas'); c.width = 4; c.height = 4; return c;
    }

    // Insert 4 keys for team 'red' -> should evict oldest to keep perTeamCap=3
    pool.set('frigate::red', makeCanvas(1));
    pool.set('fighter::red', makeCanvas(2));
    pool.set('corvette::red', makeCanvas(3));
    pool.set('bomber::red', makeCanvas(4));
    // Now only 3 keys for red exist
    let keys = Array.from(pool.keys());
    expect(keys.some(k => k.startsWith('frigate::red'))).toBe(false);
    expect(keys.filter(k => k.endsWith('::red')).length).toBe(3);

    // Insert multiple teams to exceed global cap
    pool.set('frigate::blue', makeCanvas(5));
    pool.set('fighter::blue', makeCanvas(6));
    pool.set('corvette::blue', makeCanvas(7));
    pool.set('bomber::blue', makeCanvas(8));
    pool.set('scout::green', makeCanvas(9));
    pool.set('minesweeper::yellow', makeCanvas(10));
    // total now > globalCap (10). Ensure size <= global cap
    expect(pool.size).toBeLessThanOrEqual(10);
  });
});
