import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import LRUAssetPool from '../../../src/core/assetPool.js';

describe('LRUAssetPool', () => {
  beforeEach(() => {
    // ensure NODE_ENV=test for dispose rethrow paths if needed
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    delete process.env.NODE_ENV;
    vi.restoreAllMocks();
  });

  it('stores and retrieves values and updates recency', () => {
    const p = new LRUAssetPool<string>(3);
    p.set('a', 'A').set('b', 'B').set('c', 'C');
    expect(p.size).toBe(3);
    expect(p.get('b')).toBe('B'); // access should mark as recent
    p.set('d', 'D');
    // 'a' should be evicted as oldest
    expect(p.has('a')).toBe(false);
    expect(p.has('b')).toBe(true);
    expect(p.size).toBe(3);
  });

  it('calls dispose callback on eviction and delete/clear', () => {
    const disposed: string[] = [];
    const dispose = (v: string) => {
      disposed.push(v);
    };
    const p = new LRUAssetPool<string>(2, dispose);
    p.set('x', 'X').set('y', 'Y');
    // adding third causes eviction of 'x'
    p.set('z', 'Z');
    expect(disposed).toContain('X');

    // delete should call dispose
    disposed.length = 0;
    p.delete('y');
    expect(disposed).toContain('Y');

    // clear should call dispose for remaining
    disposed.length = 0;
    p.set('a', 'A');
    p.clear();
    expect(disposed.length).toBeGreaterThanOrEqual(1);
  });

  it('rethrows dispose errors when NODE_ENV=test', () => {
    const dispose = () => {
      throw new Error('fail-dispose');
    };
    const p = new LRUAssetPool<string>(1, dispose);
    // first set will attempt to evict nothing, second will evict and call dispose which should throw
    p.set('one', '1');
    expect(() => p.set('two', '2')).toThrow('fail-dispose');
  });
});
