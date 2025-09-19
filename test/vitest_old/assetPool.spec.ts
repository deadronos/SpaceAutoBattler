import { describe, it, expect, vi } from 'vitest';
import LRUAssetPool from '../../src/core/assetPool.js';

describe('LRUAssetPool', () => {
  it('evicts least recently used items beyond capacity', () => {
    const pool = new LRUAssetPool<string>(3);
    pool.set('a', 'A');
    pool.set('b', 'B');
    pool.set('c', 'C');
    expect(Array.from(pool.keys())).toEqual(['a', 'b', 'c']);
    // access 'a' to make it most recent
    expect(pool.get('a')).toBe('A');
    pool.set('d', 'D');
    // 'b' should be evicted (least recently used)
    expect(pool.has('b')).toBe(false);
    expect(pool.has('a')).toBe(true);
    expect(pool.has('c')).toBe(true);
    expect(pool.has('d')).toBe(true);
  });

  it('invokes dispose callback on eviction', () => {
    const dispose = vi.fn();
    const pool = new LRUAssetPool<string>(1, dispose);
    pool.set('a', 'A');
    pool.set('b', 'B'); // evicts 'a'
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(dispose).toHaveBeenCalledWith('A');
  });

  it('rethrows dispose errors in test env', () => {
    const pool = new LRUAssetPool<string>(1, () => {
      throw new Error('fail');
    });
    pool.set('a', 'A');
    expect(() => pool.set('b', 'B')).toThrow('fail');
  });
});
