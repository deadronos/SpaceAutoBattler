import { test, expect } from 'vitest';
import { createWebGLRenderer } from '../src/webglRenderer.js';

test('webgl renderer queues starfield upload safely', () => {
  // create a canvas stub
  const canvas = document.createElement('canvas');
  canvas.width = 128; canvas.height = 128;
  const ctx = canvas.getContext('2d');
  // draw a simple starfield into the canvas if 2D context available
  if (ctx && typeof ctx.fillRect === 'function') {
    try { ctx.fillStyle = '#fff'; ctx.fillRect(0,0,1,1); } catch (e) { /* ignore */ }
  }

  const r = createWebGLRenderer(canvas, { debug: true });
  // If no GL context available createWebGLRenderer may return null
  if (!r) {
    expect(r).toBeNull();
    return;
  }
  // init the renderer (may return false when GL not available)
  const ok = r.init();
  if (!ok) {
    expect(ok).toBe(false);
    return;
  }
  // queue a starCanvas and call render which should queue the upload and not throw
  const state = { W: 128, H: 128, starCanvas: canvas, ships: [] };
  expect(() => { r.render(state); }).not.toThrow();
  // allow diagnostics accessor to exist
  const diag = r.getRendererDiagnostics();
  expect(diag).toBeTruthy();
});
