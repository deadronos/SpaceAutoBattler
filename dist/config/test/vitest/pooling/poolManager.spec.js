import { describe, it, expect } from 'vitest';
import { makePoolEntry, ensureEntryForKey, clearEntryFreeList } from '../../../src/pools/PoolManager';
describe('PoolManager basic behavior', () => {
    it('makePoolEntry returns sensible defaults', () => {
        const e = makePoolEntry();
        expect(e.freeList).toBeInstanceOf(Array);
        expect(e.allocated).toBe(0);
        expect(e.config).toBeDefined();
        expect(e.config?.strategy).toBe('discard-oldest');
    });
    it('ensureEntryForKey creates and reuses an entry in a Map', () => {
        const map = new Map();
        const a = ensureEntryForKey(map, 'foo');
        const b = ensureEntryForKey(map, 'foo');
        expect(a).toBe(b);
        expect(map.get('foo')).toBe(a);
    });
    it('clearEntryFreeList calls sync disposer and clears freeList', async () => {
        const disposed = [];
        const entry = makePoolEntry({ disposer: (n) => { disposed.push(n); /* void */ } });
        entry.freeList.push(1, 2, 3);
        const count = await clearEntryFreeList(entry);
        expect(count).toBe(3);
        expect(disposed).toEqual([1, 2, 3]);
        expect(entry.freeList.length).toBe(0);
    });
    it('clearEntryFreeList supports async disposers', async () => {
        const disposed = [];
        const entry = makePoolEntry({ disposer: async (n) => { await new Promise(r => setTimeout(r, 1)); disposed.push(n); } });
        entry.freeList.push(4, 5);
        const count = await clearEntryFreeList(entry);
        expect(count).toBe(2);
        expect(disposed).toEqual([4, 5]);
    });
});
