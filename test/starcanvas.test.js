import { test, expect } from 'vitest';
import { srand } from '../src/rng.js';
import { initStars, createStarCanvas, stars } from '../src/gamemanager.js';

// jsdom provides a document for canvas creation.

test('createStarCanvas returns canvas of expected size and non-empty starfield', () => {
  const W = 320, H = 180;
  srand(999);
  initStars(W, H, 50);
  const canvas = createStarCanvas(W, H);
  expect(canvas).toBeTruthy();
  expect(canvas.width).toBe(W);
  expect(canvas.height).toBe(H);
  // Basic sanity: we expect stars array length to match count we asked for
  expect(stars.length).toBe(50);
  // Optionally sample a pixel to ensure something was drawn (not guaranteed every pixel non-black)
  const ctx = canvas.getContext('2d');
  const img = ctx.getImageData(0, 0, W, H);
  // Count non-background-ish pixels (brightness threshold)
  let bright = 0;
  for (let i = 0; i < img.data.length; i += 4) {
    const r = img.data[i], g = img.data[i+1], b = img.data[i+2];
    // background is dark (#041018 -> approx rgb(4,16,24)); anything much brighter counts
    if (r > 30 || g > 40 || b > 50) { bright++; if (bright > 5) break; }
  }
  expect(bright).toBeGreaterThan(0); // at least one star drawn
});
