import { describe, it, expect } from 'vitest';
import { CanvasRenderer } from '../../src/canvasrenderer';
import { WebGLRenderer } from '../../src/webglrenderer';
import RendererConfig from '../../src/config/rendererConfig';
import { getDefaultBounds } from '../../src/config/simConfig';
import { getWebGLContext, hasWebGL } from './utils/webgl';
import { makeInitialState, createShip } from '../../src/entities';
describe('Renderer Flow', () => {
    it('CanvasRenderer should map world to screen coordinates consistently', () => {
        RendererConfig.renderScale = 1.0;
        const canvas = document.createElement('canvas');
        canvas.width = getDefaultBounds().W * RendererConfig.renderScale;
        canvas.height = getDefaultBounds().H * RendererConfig.renderScale;
        const renderer = new CanvasRenderer(canvas);
        renderer.init();
        // Place a ship at center and at edge
        const state = makeInitialState();
        state.ships.push(createShip('fighter', 960, 540, 'red'), createShip('fighter', 0, 0, 'blue'), createShip('fighter', 1920, 1080, 'blue'));
        renderer.renderState(state);
        // Check that buffer canvas is correct size
        expect(renderer.bufferCanvas.width).toBeCloseTo(getDefaultBounds().W * RendererConfig.renderScale, 1);
        expect(renderer.bufferCanvas.height).toBeCloseTo(getDefaultBounds().H * RendererConfig.renderScale, 1);
        // Check that ships are rendered within buffer bounds
        for (const s of state.ships) {
            const sx = (s.x || 0) * RendererConfig.renderScale;
            const sy = (s.y || 0) * RendererConfig.renderScale;
            expect(sx).toBeGreaterThanOrEqual(0);
            expect(sx).toBeLessThanOrEqual(renderer.bufferCanvas.width);
            expect(sy).toBeGreaterThanOrEqual(0);
            expect(sy).toBeLessThanOrEqual(renderer.bufferCanvas.height);
        }
    });
    it('CanvasRenderer should resize buffer and copy after drawing', () => {
        RendererConfig.renderScale = 1.5;
        const canvas = document.createElement('canvas');
        canvas.width = getDefaultBounds().W * RendererConfig.renderScale;
        canvas.height = getDefaultBounds().H * RendererConfig.renderScale;
        const renderer = new CanvasRenderer(canvas);
        renderer.init();
        const state = makeInitialState();
        renderer.renderState(state);
        expect(renderer.bufferCanvas.width).toBeCloseTo(getDefaultBounds().W * RendererConfig.renderScale, 1);
        expect(renderer.bufferCanvas.height).toBeCloseTo(getDefaultBounds().H * RendererConfig.renderScale, 1);
    });
    describe('WebGLRenderer', () => {
        it('should resize FBO and copy after drawing', () => {
            if (!hasWebGL()) {
                // Skip test if WebGL is not available in environment
                return;
            }
            RendererConfig.renderScale = 2.0;
            const canvas = document.createElement('canvas');
            canvas.width = getDefaultBounds().W * RendererConfig.renderScale;
            canvas.height = getDefaultBounds().H * RendererConfig.renderScale;
            const renderer = new WebGLRenderer(canvas);
            const gl = getWebGLContext(canvas);
            if (!gl)
                return;
            renderer.init();
            const state = makeInitialState();
            renderer.renderState(state);
            expect(canvas.width).toBeCloseTo(getDefaultBounds().W * RendererConfig.renderScale, 1);
            expect(canvas.height).toBeCloseTo(getDefaultBounds().H * RendererConfig.renderScale, 1);
        });
    });
});
