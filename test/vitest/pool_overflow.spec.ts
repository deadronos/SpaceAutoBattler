import { describe, it, expect } from 'vitest';
import Pool from '../../src/pools/pool';

describe('Pool overflow behavior', () => {
  it('manual release respects duplicate prevention and size math', () => {
    const p = new Pool(() => ({ v: Math.random() } as any));
    const a = p.acquire();
    p.release(a);
    expect(p.size()).toBe(1);
    p.release(a);
    expect(p.size()).toBe(1);
  });
});
