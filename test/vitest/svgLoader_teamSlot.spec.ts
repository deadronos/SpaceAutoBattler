import { describe, it, expect } from 'vitest';
import { applyTeamColorsToSvg } from '../../src/assets/svgLoader';

const svgWithSlots = `<?xml version="1.0"?>
<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <rect id="hull" x="0" y="0" width="64" height="64" fill="#222" data-team-slot="hull" />
  <g id="trim" data-team-slot="trim">
    <rect x="2" y="2" width="60" height="60" fill="#fff" />
  </g>
</svg>`;

describe('applyTeamColorsToSvg - data-team-slot', () => {
  it('applies colors using data-team-slot attribute', () => {
    const out = applyTeamColorsToSvg(svgWithSlots as any, { hull: '#ff0000', trim: '#00ff00' });
    expect(out).toContain('fill="#ff0000"');
    expect(out).toContain('#00ff00');
  });
});
