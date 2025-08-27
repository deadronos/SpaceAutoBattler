import Pool from '../../src/pools/pool';
import { describe, it, expect } from 'vitest';
describe('Pool class', () => {
    it('increments created when acquiring new objects', () => {
        const p = new Pool(() => ({ v: Math.random() }));
        const before = p.created;
        const a = p.acquire();
        expect(p.created).toBe(before + 1);
        // Releasing and acquiring from pool should not increment created
        p.release(a);
        const b = p.acquire();
        expect(p.created).toBe(before + 1);
        p.release(b);
    });
    it('does not duplicate object when released twice', () => {
        const p = new Pool(() => ({ v: Math.random() }));
        const a = p.acquire();
        expect(p.size()).toBe(0);
        p.release(a);
        expect(p.size()).toBe(1);
        // Releasing same object again should not increase size
        p.release(a);
        expect(p.size()).toBe(1);
    });
});
