import { describe, it, expect } from 'vitest';
import { CanvasRenderer } from '../../src/canvasrenderer';
import { WebGLRenderer } from '../../src/webglrenderer';
import RendererConfig from '../../src/config/rendererConfig';
import { getDefaultBounds } from '../../src/config/displayConfig';
import { getWebGLContext, hasWebGL } from './utils/webgl';

describe('Renderer Flow', () => {
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
