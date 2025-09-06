import { describe, it, expect } from 'vitest';
import { BatchedQueryManager } from '../../src/core/ai/batchedQueries.js';

describe('BatchedQueryManager', () => {
  it('resetForFrame clears caches and updates frameId without throwing', () => {
    const bq = new BatchedQueryManager();
    // Access private internals via casting for test-only inspection
    const asAny = bq as any;
    // Populate caches
    asAny.results.nearestEnemyCache.set(1, null);
    asAny.results.nearbyEnemiesCache.set(2, new Map());
    asAny.results.nearbyFriendsCache.set(3, new Map());
    asAny.results.separationNeighborsCache.set(4, [{ x: 1, y: 2, z: 3 }]);

    // Call reset
    asAny.frameId = 123;
    bq.resetForFrame(999);

    // Expect caches cleared but objects still present as Maps (we clear the maps)
    expect(asAny.results.nearestEnemyCache.size).toBe(0);
    expect(asAny.results.nearbyEnemiesCache.size).toBe(0);
    expect(asAny.results.nearbyFriendsCache.size).toBe(0);
    expect(asAny.results.separationNeighborsCache.size).toBe(0);
    expect(asAny.frameId).toBe(999);
  });
});
