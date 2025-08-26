import { describe, it, expect } from 'vitest';
import Pool from '../../src/pools/pool';

describe('Pool leak detection', () => {
  it('does not leak objects after repeated acquire/release', () => {
    const p = new Pool(() => ({ v: Math.random() } as any));
    const objs: any[] = [];
    for (let i = 0; i < 1000; i++) {
      const obj = p.acquire();
      objs.push(obj);
    }
    // Release all
    for (const obj of objs) p.release(obj);
    expect(p.size()).toBe(1000);
    // Acquire all again
    const reacquired: any[] = [];
    for (let i = 0; i < 1000; i++) reacquired.push(p.acquire());
    expect(p.size()).toBe(0);
    // Release all again
    for (const obj of reacquired) p.release(obj);
    expect(p.size()).toBe(1000);
    // No duplicates
    const unique = new Set(p['stack']);
    expect(unique.size).toBe(1000);
  });
});
