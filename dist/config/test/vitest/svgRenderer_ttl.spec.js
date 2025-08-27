import { describe, it, expect, beforeEach } from 'vitest';
import { _clearRasterCache, cacheCanvasForAsset, setRasterCacheMaxAge, getCanvasFromCache } from '../../src/assets/svgRenderer';
function makeCanvas(w = 32, h = 32) {
    const c = globalThis.document?.createElement('canvas');
    if (!c)
        return undefined;
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    if (ctx) {
        ctx.fillStyle = 'red';
        ctx.fillRect(0, 0, w, h);
    }
    return c;
}
describe('svgRenderer TTL behavior', () => {
    beforeEach(() => {
        _clearRasterCache();
        setRasterCacheMaxAge(50); // 50ms TTL for fast test
    });
    it('expires entries after TTL and getCanvasFromCache returns undefined', async () => {
        const canvas = makeCanvas();
        if (!canvas) {
            // no DOM/canvas available in this environment — skip assertion
            expect(canvas).toBeFalsy();
            return;
        }
        // store canvas with key
        cacheCanvasForAsset('test-ttl', { primary: '#ff0000' }, canvas.width, canvas.height, canvas);
        // immediate read should return the canvas
        const c1 = getCanvasFromCache('test-ttl', { primary: '#ff0000' }, canvas.width, canvas.height);
        expect(c1).toBeDefined();
        // wait past TTL
        await new Promise(r => setTimeout(r, 80));
        const c2 = getCanvasFromCache('test-ttl', { primary: '#ff0000' }, canvas.width, canvas.height);
        expect(c2).toBeUndefined();
    });
});
