import { beforeEach, test, expect } from 'vitest';
import { initRenderer, stars } from '../src/renderer.js';

// Ensure the canvas environment is available
import './setupCanvas.js';

beforeEach(() => {
  // Provide a predictable window size for star placement
  globalThis.window = globalThis.window || {};
  // set a deterministic canvas size
  const W = 800;
  const H = 600;
  // jsdom's document.createElement('canvas') will be used by initRenderer; set window dimensions
  globalThis.innerWidth = W;
  globalThis.innerHeight = H;
  // create a canvas element so initRenderer can find it
  const canvas = document.createElement('canvas');
  canvas.id = 'world';
  canvas.width = W;
  canvas.height = H;
  document.body.appendChild(canvas);
});

test('initRenderer populates stars when W/H known', () => {
  // Clear any pre-existing stars
  stars.length = 0;
  initRenderer();
  expect(stars.length).toBeGreaterThan(0);
  // Expect star coordinates to be within bounds
  for (const s of stars) {
    expect(s.x).toBeGreaterThanOrEqual(0);
    expect(s.x).toBeLessThanOrEqual(globalThis.innerWidth);
    expect(s.y).toBeGreaterThanOrEqual(0);
    expect(s.y).toBeLessThanOrEqual(globalThis.innerHeight);
    expect(s.r).toBeGreaterThan(0);
    expect([0.2,0.5,1.0]).toContain(s.d);
  }
});
