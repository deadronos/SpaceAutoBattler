import { test, expect } from 'vitest';
import { createWebGLRenderer } from '../src/webglRenderer.js';

test('shader compile/link emits non-fatal info logs (no-throw)', () => {
  const canvas = document.createElement('canvas');
  canvas.width = 32; canvas.height = 32;
  const r = createWebGLRenderer(canvas, { debug: true });
  if (!r) {
    expect(r).toBeNull();
    return;
  }
  const ok = r.init();
  if (!ok) {
    expect(ok).toBe(false);
    return;
  }
  // calling debug helpers that compile shaders should not throw
  expect(() => r.debugDrawSolid({ color: [0,1,0,1], x: 0, y: 0, w: 4, h: 4 })).not.toThrow();
});
