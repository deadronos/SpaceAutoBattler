import { describe, it, expect, vi } from 'vitest';
import { svgToPolylines, getSvgPolylinesCacheStats, resetSvgPolylinesCacheStats, clearSvgPolylinesCache } from '../../src/assets/svgToPolylines';
describe('svgToPolylines cache', () => {
    const simpleSvg = `<svg viewBox="0 0 100 100"><polygon points="10,10 40,10 10,40"/></svg>`;
    it('returns same object for repeated calls with same assetId (cache hit)', () => {
        resetSvgPolylinesCacheStats();
        clearSvgPolylinesCache();
        const a = svgToPolylines(simpleSvg, { assetId: 'cache-test', tolerance: 0.01 });
        const b = svgToPolylines(simpleSvg, { assetId: 'cache-test', tolerance: 0.01 });
        expect(a).toBe(b);
        const stats = getSvgPolylinesCacheStats();
        expect(stats.hits).toBe(1);
        expect(stats.misses).toBe(1);
    });
    it('different assetId is a cache miss', () => {
        resetSvgPolylinesCacheStats();
        clearSvgPolylinesCache();
        const a = svgToPolylines(simpleSvg, { assetId: 'cache-test-A', tolerance: 0.01 });
        const b = svgToPolylines(simpleSvg, { assetId: 'cache-test-B', tolerance: 0.01 });
        expect(a).not.toBe(b);
        const stats = getSvgPolylinesCacheStats();
        // two distinct misses, no hits
        expect(stats.hits).toBe(0);
        expect(stats.misses).toBe(2);
    });
    it('evicts oldest entry when capacity exceeded', () => {
        resetSvgPolylinesCacheStats();
        clearSvgPolylinesCache();
        // This relies on internal CACHE_MAX_ENTRIES currently set to 200.
        const MAX = 200;
        const first = svgToPolylines(simpleSvg, { assetId: 'evict-0', tolerance: 0.01 });
        // insert MAX entries to force eviction of the oldest when the (MAX+1)th is inserted
        for (let i = 1; i <= MAX; i++) {
            svgToPolylines(simpleSvg, { assetId: `evict-${i}`, tolerance: 0.01 });
        }
        // now the original 'evict-0' should have been evicted; a new call returns a fresh object
        const after = svgToPolylines(simpleSvg, { assetId: 'evict-0', tolerance: 0.01 });
        expect(after).not.toBe(first);
        const stats = getSvgPolylinesCacheStats();
        // we inserted MAX+2 calls that all missed (initial evict-0, MAX unique inserts, final evict-0 after eviction)
        expect(stats.hits).toBe(0);
        expect(stats.misses).toBe(MAX + 2);
    });
    it('assetId keying ignores svg string when same assetId provided', () => {
        resetSvgPolylinesCacheStats();
        clearSvgPolylinesCache();
        const svgA = `<svg viewBox="0 0 100 100"><polygon points="10,10 40,10 10,40"/></svg>`;
        const svgB = `<svg viewBox="0 0 100 100"><polygon points="20,20 50,20 20,50"/></svg>`;
        const r1 = svgToPolylines(svgA, { assetId: 'same-id', tolerance: 0.01 });
        const r2 = svgToPolylines(svgB, { assetId: 'same-id', tolerance: 0.01 });
        // both calls used same assetId key => cache returns the same stored result
        expect(r1).toBe(r2);
        const stats = getSvgPolylinesCacheStats();
        // first call miss, second call hit
        expect(stats.hits).toBe(1);
        expect(stats.misses).toBe(1);
    });
    it('expires entries after TTL', () => {
        // Use fake timers to simulate expiry. TTL in module is 1 hour (3600000 ms).
        const TTL = 1000 * 60 * 60;
        resetSvgPolylinesCacheStats();
        clearSvgPolylinesCache();
        vi.useFakeTimers();
        try {
            const start = 1_600_000_000_000; // arbitrary
            vi.setSystemTime(start);
            const r1 = svgToPolylines(simpleSvg, { assetId: 'ttl-id', tolerance: 0.01 });
            // advance time beyond TTL
            vi.setSystemTime(start + TTL + 1000);
            const r2 = svgToPolylines(simpleSvg, { assetId: 'ttl-id', tolerance: 0.01 });
            expect(r2).not.toBe(r1);
            const stats = getSvgPolylinesCacheStats();
            // first call miss, second saw expired entry and counts as miss again
            expect(stats.hits).toBe(0);
            expect(stats.misses).toBe(2);
        }
        finally {
            vi.useRealTimers();
        }
    });
});
