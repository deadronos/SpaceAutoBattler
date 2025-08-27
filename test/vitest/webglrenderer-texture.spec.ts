import { describe, it, expect } from "vitest";
import { WebGLRenderer } from "../../src/webglrenderer";
import { getDefaultShipType } from "../../src/config/entitiesConfig";
import { getWebGLContext, hasWebGL } from "./utils/webgl";

describe("WebGLRenderer", () => {
  describe("texture cache", () => {
    it("should produce and cache a texture for a given ship type", () => {
      if (!hasWebGL()) {
        // Environment doesn't have WebGL; skip without failing the suite
        return;
      }

      const canvas = document.createElement("canvas");
      canvas.width = 128;
      canvas.height = 128;
      const gl = getWebGLContext(canvas);
      if (!gl) return;

      const renderer = new WebGLRenderer(canvas);
      const ok = renderer.init();
      if (!ok) return;

      const shipType = getDefaultShipType();
      const state = require('../../src/entities').makeInitialState();
      const ship = require('../../src/entities').createShip(shipType, 10, 10, 0, 'red');
      state.ships.push(ship);
      renderer.renderState(state);

      expect(renderer.hasCachedTexture(shipType)).toBeTruthy();
      it("should dispose all cached textures and clear cache on shutdown", () => {
        if (!hasWebGL()) return;
        const canvas = document.createElement("canvas");
        canvas.width = 128;
        canvas.height = 128;
        const renderer = new WebGLRenderer(canvas);
        expect(renderer.init()).toBeTruthy();
        renderer.preloadAllAssets();
        // All asset keys should have cached textures
        const keys = Object.keys((renderer as any).shapeTextures);
        expect(keys.length).toBeGreaterThan(0);
        for (const key of keys) {
          expect(renderer.hasCachedTexture(key)).toBeTruthy();
        }
        renderer.dispose();
        // After dispose, all textures should be null and cache empty
        for (const key of keys) {
          expect(renderer.hasCachedTexture(key)).toBeFalsy();
        }
        expect(Object.keys((renderer as any).shapeTextures).length).toBe(0);
      });
    });
  });
});

describe("WebGLRenderer asset lifecycle performance", () => {
  it("should preload and dispose all assets efficiently", () => {
    if (!hasWebGL()) return;
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const renderer = new WebGLRenderer(canvas);
    expect(renderer.init()).toBeTruthy();

    // Measure preload time
    const preloadStart = performance.now();
    renderer.preloadAllAssets();
    const preloadEnd = performance.now();
    const preloadDuration = preloadEnd - preloadStart;
    // Assert preload is fast (threshold: 100ms)
    expect(preloadDuration).toBeLessThan(100);

    // Measure dispose time
    const disposeStart = performance.now();
    renderer.dispose();
    const disposeEnd = performance.now();
    const disposeDuration = disposeEnd - disposeStart;
    // Assert dispose is fast (threshold: 50ms)
    expect(disposeDuration).toBeLessThan(50);
  });
});
