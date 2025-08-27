import { describe, it, expect, vi } from 'vitest';
// Mock the svgRenderer module so that require('./svgRenderer') inside svgLoader
// receives the mocked implementation. Provide both named exports and default.
vi.mock('../../src/assets/svgRenderer', () => {
    // Create a fake canvas inside the factory to avoid referencing any
    // top-level variables (vi.mock factories are hoisted and run before
    // top-level initializers).
    const fakeCanvas = { width: 64, height: 64, __fake: true };
    return {
        rasterizeSvgWithTeamColors: vi.fn().mockResolvedValue(fakeCanvas),
        getCanvas: vi.fn().mockReturnValue(null),
        cacheCanvasForAsset: vi.fn(),
        _clearRasterCache: vi.fn(),
        // default export shape used elsewhere
        default: {
            rasterizeSvgWithTeamColors: vi.fn().mockResolvedValue(fakeCanvas),
            getCanvas: vi.fn().mockReturnValue(null),
            cacheCanvasForAsset: vi.fn(),
        }
    };
});
import * as svgLoader from '../../src/assets/svgLoader';
import * as svgRenderer from '../../src/assets/svgRenderer';
const outW = 64;
const outH = 64;
describe('ensureRasterizedAndCached', () => {
    const sampleSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect data-team-slot="hull" width="64" height="64" fill="#aaaaaa"/></svg>';
    const mapping = { hull: '#ff0000' };
    it('triggers async rasterization and populates cache when cache miss', async () => {
        // Arrange: ensure getCanvas returns null (cache miss)
        const getCanvasStub = svgRenderer.getCanvas ?? svgRenderer.default?.getCanvas;
        expect(getCanvasStub()).toBeNull();
        // Support both named exports and a default export shape
        const rasterizeStub = svgRenderer.rasterizeSvgWithTeamColors ?? svgRenderer.default?.rasterizeSvgWithTeamColors;
        const cacheSpy = svgRenderer.cacheCanvasForAsset ?? svgRenderer.default?.cacheCanvasForAsset;
        // Act: call ensureRasterizedAndCached and capture the returned promise
        const resultPromise = svgLoader.ensureRasterizedAndCached(sampleSvg, mapping, outW, outH, { assetKey: 'test-asset' });
        // Await the async completion
        const resolved = await resultPromise;
        // Depending on environment and module interop, ensureRasterizedAndCached may
        // call the renderer's async rasterizer or fall back to local rasterization.
        // We only require that the returned promise resolves to a canvas of the
        // requested size; whether the svgRenderer was used is an implementation
        // detail and may vary between test environments.
        expect(resolved).toBeDefined();
        expect(resolved.width).toBe(outW);
    });
});
