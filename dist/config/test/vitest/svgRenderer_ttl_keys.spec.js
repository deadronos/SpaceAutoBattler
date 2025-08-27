import { describe, it, expect, beforeEach } from 'vitest';
import { _clearRasterCache, cacheCanvasForAsset, setRasterCacheMaxAge, _getRasterCacheKeysForTest, getCanvasFromCache } from '../../src/assets/svgRenderer';
function makeCanvas(w = 16, h = 16) {
    const c = globalThis.document?.createElement('canvas');
    if (!c)
        return undefined;
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    if (ctx) {
        ctx.fillStyle = 'blue';
        ctx.fillRect(0, 0, w, h);
    }
    return c;
}
describe('svgRenderer TTL key eviction', () => {
    beforeEach(() => {
        _clearRasterCache();
        setRasterCacheMaxAge(30); // 30ms TTL for fast test
    });
    it('removes keys from _getRasterCacheKeysForTest when expired', async () => {
        const canvas = makeCanvas();
        if (!canvas) {
            expect(canvas).toBeFalsy();
            return;
        }
        cacheCanvasForAsset('k1', {}, canvas.width, canvas.height, canvas);
        cacheCanvasForAsset('k2', {}, canvas.width, canvas.height, canvas);
        // both keys present
        let keys = _getRasterCacheKeysForTest();
        expect(keys.some(k => k.startsWith('k1'))).toBe(true);
        expect(keys.some(k => k.startsWith('k2'))).toBe(true);
        // wait past TTL
        await new Promise(r => setTimeout(r, 60));
        // accessing via getCanvasFromCache should return undefined and trigger eviction for each key
        const got1 = getCanvasFromCache('k1', {}, canvas.width, canvas.height);
        const got2 = getCanvasFromCache('k2', {}, canvas.width, canvas.height);
        expect(got1).toBeUndefined();
        expect(got2).toBeUndefined();
        keys = _getRasterCacheKeysForTest();
        expect(keys.some(k => k.startsWith('k1'))).toBe(false);
        expect(keys.some(k => k.startsWith('k2'))).toBe(false);
    });
});
