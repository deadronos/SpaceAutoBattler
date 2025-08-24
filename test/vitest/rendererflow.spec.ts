import { describe, it, expect } from 'vitest';
import { CanvasRenderer } from '../../src/canvasrenderer';
import { WebGLRenderer } from '../../src/webglrenderer';
import RendererConfig from '../../src/config/rendererConfig';
import { getDefaultBounds } from '../../src/config/simConfig';
import { getWebGLContext, hasWebGL } from './utils/webgl';

describe('Renderer Flow', () => {
  it('CanvasRenderer should map world to screen coordinates consistently', () => {
    RendererConfig.renderScale = 1.0;
    const canvas = document.createElement('canvas');
    canvas.width = getDefaultBounds().W * RendererConfig.renderScale;
    canvas.height = getDefaultBounds().H * RendererConfig.renderScale;
    const renderer = new CanvasRenderer(canvas);
    renderer.init();
    // Place a ship at center and at edge
    const state = {
      ships: [
        { x: 960, y: 540, radius: 20, angle: 0, turrets: [], team: 'red' },
        { x: 0, y: 0, radius: 20, angle: 0, turrets: [], team: 'blue' },
        { x: 1920, y: 1080, radius: 20, angle: 0, turrets: [], team: 'blue' }
      ],
      bullets: [],
      t: 0
    };
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
    renderer.renderState({ ships: [], bullets: [], t: 0 });
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
      if (!gl) return;
      renderer.init();
      renderer.renderState({ ships: [], bullets: [], t: 0 });
      expect(renderer.fboWidth).toBeCloseTo(getDefaultBounds().W * RendererConfig.renderScale, 1);
      expect(renderer.fboHeight).toBeCloseTo(getDefaultBounds().H * RendererConfig.renderScale, 1);
    });
  });
});
