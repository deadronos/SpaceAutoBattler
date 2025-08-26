import { describe, it, expect } from 'vitest';
import { svgToPolylines } from '../../src/assets/svgToPolylines';

describe('svgToPolylines', () => {
  it('parses polygon element and normalizes coords', () => {
    const svg = `<svg viewBox="0 0 100 100"><polygon points="10,10 90,10 50,90" /></svg>`;
    const res = svgToPolylines(svg, { tolerance: 0.1 });
    expect(res.contours.length).toBeGreaterThan(0);
    const contour = res.contours[0];
    // Points should be normalized roughly between -1 and 1
    for (const [x, y] of contour) {
      expect(x).toBeGreaterThanOrEqual(-1.1);
      expect(x).toBeLessThanOrEqual(1.1);
      expect(y).toBeGreaterThanOrEqual(-1.1);
      expect(y).toBeLessThanOrEqual(1.1);
    }
  });

  it('parses circle into polygonal contour', () => {
    const svg = `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="20" /></svg>`;
    const res = svgToPolylines(svg, {});
    expect(res.contours.length).toBeGreaterThan(0);
    const c = res.contours[0];
  expect(c.length).toBeGreaterThanOrEqual(8);
  });

  it('parses simple path with moves and lines', () => {
    const svg = `<svg viewBox="0 0 100 100"><path d="M10 10 L90 10 L50 90 Z" /></svg>`;
    const res = svgToPolylines(svg, {});
    expect(res.contours.length).toBeGreaterThan(0);
    const c = res.contours[0];
    expect(c.length).toBeGreaterThanOrEqual(3);
  });
});
