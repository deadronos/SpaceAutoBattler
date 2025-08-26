import { describe, it, expect } from 'vitest';
import { rasterizeSvgWithTeamColors, _clearRasterCache } from '../../src/assets/svgRenderer';

const sampleSvg = `<?xml version="1.0"?><svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg"><rect data-team="primary" x="0" y="0" width="10" height="10"/></svg>`;

describe('rasterizeSvgWithTeamColors cache', () => {
  it('returns the same canvas for repeated calls with same key and mapping', async () => {
    _clearRasterCache();
    const mapping = { primary: '#112233' };
  const a = rasterizeSvgWithTeamColors(sampleSvg as any, mapping, 10, 10, { assetKey: 'asset-1' });
  const b = rasterizeSvgWithTeamColors(sampleSvg as any, mapping, 10, 10, { assetKey: 'asset-1' });
  // wait for both to resolve and ensure they resolve to the same canvas instance
  const c = await a;
  const d = await b;
  expect(c).toBe(d);
  });

  it('clearing cache causes new promise to be created', async () => {
    _clearRasterCache();
    const mapping = { primary: '#112233' };
  const a = rasterizeSvgWithTeamColors(sampleSvg as any, mapping, 10, 10, { assetKey: 'asset-2' });
  const first = await a;
  _clearRasterCache();
  const b = rasterizeSvgWithTeamColors(sampleSvg as any, mapping, 10, 10, { assetKey: 'asset-2' });
  const second = await b;
  // canvases should be distinct objects when re-rasterized after cache clear
  expect(second).not.toBe(first);
  });
});
