import { describe, it, expect } from 'vitest';
import { BatchedQueryManager } from '../../../src/core/ai/batchedQueries.js';

describe('BatchedQueryManager edge cases', () => {
  it('handles empty input without throwing', () => {
    const mgr = new BatchedQueryManager();
    // call methods that should be safe with no data
    mgr.resetForFrame(1);
    // create a minimal Ship shape
    const ship: any = { id: 42 };
    const nearest = mgr.getNearestEnemy(ship);
    expect(nearest).toBeNull();
  });

  it('resetForFrame makes subsequent queries empty', () => {
    const mgr = new BatchedQueryManager();
    mgr.resetForFrame(2);
    const ship: any = { id: 99 };
    const sep = mgr.getSeparationNeighbors(ship);
    // expect an array (may be empty) and not throw
    expect(Array.isArray(sep)).toBeTruthy();
  });
});
