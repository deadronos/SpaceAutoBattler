import { describe, it, expect } from 'vitest';
import { WebGLRenderer } from '../../src/webglrenderer';
import { getDefaultShipType } from '../../src/config/entitiesConfig';
import { getWebGLContext, hasWebGL } from './utils/webgl';

describe('WebGLRenderer', () => {
  describe('texture cache', () => {
    it('should produce and cache a texture for a given ship type', () => {
      if (!hasWebGL()) {
        // Environment doesn't have WebGL; skip without failing the suite
        return;
      }

      const canvas = document.createElement('canvas');
      canvas.width = 128; canvas.height = 128;
      const gl = getWebGLContext(canvas);
      if (!gl) return;

      const renderer = new WebGLRenderer(canvas);
      const ok = renderer.init();
      if (!ok) return;

      const shipType = getDefaultShipType();
      renderer.renderState({ ships: [{ type: shipType, x: 10, y: 10, radius: 6 }], bullets: [], particles: [], t: 0 });

      expect(renderer.hasCachedTexture(shipType)).toBeTruthy();
    });
  });
});
