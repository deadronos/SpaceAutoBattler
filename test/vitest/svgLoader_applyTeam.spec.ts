import { describe, it, expect } from 'vitest';
import { applyTeamColorsToSvg } from '../../src/assets/svgLoader';

const sampleSvg = `<?xml version="1.0"?>
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <rect id="hull" x="0" y="0" width="100" height="100" fill="#222" data-team="primary" />
  <g id="accentGroup" data-team="accent">
    <circle cx="70" cy="30" r="10" fill="#fff" />
  </g>
  <rect class="turret" x="45" y="10" width="10" height="10" />
</svg>`;

describe('applyTeamColorsToSvg', () => {
  it('applies primary and accent colors to matching elements', () => {
    const mapping = { primary: '#aabb00', accent: '#00aaff' };
    const out = applyTeamColorsToSvg(sampleSvg as any, mapping);
    expect(out).toContain('fill="#aabb00"');
    // accent group should have child circle unchanged but group itself gets fill/stroke attrs
    expect(out).toContain('data-team="accent"');
    expect(out).toContain('#00aaff');
  });

  it('respects data-team-apply attribute when present', () => {
    const svg = `<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"><rect data-team="primary" data-team-apply="stroke" x="0" y="0" width="10" height="10"/></svg>`;
    const out = applyTeamColorsToSvg(svg as any, { primary: '#123456' });
    // stroke should be applied, not fill
    expect(out).toContain('stroke="#123456"');
    expect(out).not.toContain('fill="#123456"');
  });
});
