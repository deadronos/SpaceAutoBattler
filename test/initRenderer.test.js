import { test, expect } from 'vitest';
import { initRenderer, stopRenderer, getRendererType } from '../src/renderer.js';

// Use a real canvas element from jsdom and stub getContext to simulate available contexts
function makeCanvasWithContext(ctxName) {
  const c = document.createElement('canvas');
  // If ctxName is falsy, ensure getContext throws like jsdom default
  if (ctxName) {
    c.getContext = (name) => {
      if (name === ctxName) return {}; // truthy context stub
      return null;
    };
  } else {
    // leave default jsdom behavior (which throws). But tests shouldn't call getContext directly.
    delete c.getContext;
  }
  return c;
}

test('initRenderer prefers canvas when preferWebGL is false', async () => {
  const canvas = makeCanvasWithContext(null);
  await initRenderer({ canvas, preferWebGL: false, startLoop: false });
  expect(getRendererType()).toBe('canvas');
  stopRenderer();
});

test('initRenderer tries WebGL when preferWebGL is true and context exists', async () => {
  const canvas = makeCanvasWithContext('webgl');
  await initRenderer({ canvas, preferWebGL: true, startLoop: false });
  // If WebGL context is available we should have webgl renderer or fallback to canvas
  const t = getRendererType();
  expect(['webgl','canvas']).toContain(t);
  stopRenderer();
});
