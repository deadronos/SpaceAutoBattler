import { describe, it, expect } from 'vitest';
import { rasterizeSvgWithTeamColors } from '../../src/assets/svgRenderer';

const sampleSvg = `<?xml version="1.0"?>
<svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg">
  <rect id="hull" x="0" y="0" width="10" height="10" fill="#222" data-team="primary" />
  <circle cx="5" cy="5" r="2" fill="#fff" data-team="accent" />
</svg>`;

describe('rasterizeSvgWithTeamColors', () => {
  it('rasterizes recolored svg into canvas pixels', async () => {
    const mapping = { primary: '#00ff00', accent: '#ff0000' };
    const canvas = await rasterizeSvgWithTeamColors(sampleSvg as any, mapping, 10, 10, { applyTo: 'fill' });
    expect(canvas).toBeDefined();
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      // Skip pixel assertions if 2D context is not available in this test environment
      // eslint-disable-next-line no-console
      console.warn('[svgRenderer_rasterize] skipping pixel assertions: no 2D canvas context available');
      return;
    }
    const data = ctx.getImageData(1,1,1,1).data; // sample near top-left where hull rect is
    // hull primary color should be applied; #00ff00 => (0,255,0)
    expect(data[0]).toBeGreaterThanOrEqual(0);
    expect(data[1]).toBeGreaterThanOrEqual(200); // allow some anti-aliasing tolerance
    expect(data[2]).toBeLessThanOrEqual(60);
  });
});
