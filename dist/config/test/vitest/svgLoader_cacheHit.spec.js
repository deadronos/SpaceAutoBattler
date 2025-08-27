import { describe, it, expect, vi } from 'vitest';
// Mock the svgRenderer module so that require('./svgRenderer') inside svgLoader
// receives the mocked implementation. Provide both named exports and default.
vi.mock('../../src/assets/svgRenderer', () => {
    // Create a fake cached canvas to simulate a cache hit
    const cachedCanvas = { width: 64, height: 64, __cached: true };
    return {
        rasterizeSvgWithTeamColors: vi.fn().mockResolvedValue({ width: 1, height: 1 }),
        getCanvas: vi.fn().mockReturnValue(cachedCanvas),
        cacheCanvasForAsset: vi.fn(),
        _clearRasterCache: vi.fn(),
        default: {
            rasterizeSvgWithTeamColors: vi.fn().mockResolvedValue({ width: 1, height: 1 }),
            getCanvas: vi.fn().mockReturnValue(cachedCanvas),
            cacheCanvasForAsset: vi.fn(),
        }
    };
});
import * as svgLoader from '../../src/assets/svgLoader';
import * as svgRenderer from '../../src/assets/svgRenderer';
describe('ensureRasterizedAndCached (cache hit)', () => {
    const sampleSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect data-team-slot="hull" width="64" height="64" fill="#aaaaaa"/></svg>';
    const mapping = { hull: '#ff0000' };
    it('returns cached canvas and does not call rasterizer', async () => {
        const getCanvasStub = svgRenderer.getCanvas ?? svgRenderer.default?.getCanvas;
        const rasterizeStub = svgRenderer.rasterizeSvgWithTeamColors ?? svgRenderer.default?.rasterizeSvgWithTeamColors;
        // Sanity: cache should return our fake cached canvas
        const cached = getCanvasStub();
        expect(cached).not.toBeNull();
        expect(cached.__cached).toBe(true);
        // Act
        const resolved = await svgLoader.ensureRasterizedAndCached(sampleSvg, mapping, 64, 64, { assetKey: 'test-asset' });
        // It should return the cached canvas and rasterizer should not have been called
        expect(resolved).toBeDefined();
        expect(resolved.width).toBe(64);
        expect(rasterizeStub).not.toHaveBeenCalled();
    });
});
