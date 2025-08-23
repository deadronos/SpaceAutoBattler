import { describe, it, expect } from 'vitest';
import { CanvasRenderer } from '../../src/canvasrenderer';
import { WebGLRenderer } from '../../src/webglrenderer';
import RendererConfig from '../../src/config/rendererConfig';
import { getDefaultBounds } from '../../src/config/displayConfig';

describe('Renderer Flow', () => {
  it('CanvasRenderer should resize buffer and copy after drawing', () => {
    RendererConfig.renderScale = 1.5;
    const canvas = document.createElement('canvas');
    // Set canvas width/height to match expected buffer size
    canvas.width = getDefaultBounds().W * RendererConfig.renderScale;
    canvas.height = getDefaultBounds().H * RendererConfig.renderScale;
    const renderer = new CanvasRenderer(canvas);
    renderer.init();
    renderer.renderState({ ships: [], bullets: [], t: 0 });
    expect(renderer.bufferCanvas.width).toBeCloseTo(getDefaultBounds().W * RendererConfig.renderScale, 1);
    expect(renderer.bufferCanvas.height).toBeCloseTo(getDefaultBounds().H * RendererConfig.renderScale, 1);
  });

  it('WebGLRenderer should resize FBO and copy after drawing', () => {
    RendererConfig.renderScale = 2.0;
    const canvas = document.createElement('canvas');
    // Set canvas width/height to match expected buffer size
    canvas.width = getDefaultBounds().W * RendererConfig.renderScale;
    canvas.height = getDefaultBounds().H * RendererConfig.renderScale;
    const renderer = new WebGLRenderer(canvas);
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) {
      // Skip test if WebGL is not available in environment
      return;
    }
    renderer.init();
    renderer.renderState({ ships: [], bullets: [], t: 0 });
    expect(renderer.fboWidth).toBeCloseTo(getDefaultBounds().W * RendererConfig.renderScale, 1);
    expect(renderer.fboHeight).toBeCloseTo(getDefaultBounds().H * RendererConfig.renderScale, 1);
  });
});
