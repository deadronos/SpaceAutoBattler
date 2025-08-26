import { describe, it, expect } from 'vitest';
import { parseSvgForMounts } from '../../src/assets/svgLoader';

const sampleSvg = `<?xml version="1.0"?>
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <rect id="hull" x="0" y="0" width="100" height="100" fill="#222" data-team="primary" />
  <g id="accentGroup" data-team="accent">
    <circle cx="70" cy="30" r="10" fill="#fff" />
  </g>
  <rect class="turret" x="45" y="10" width="10" height="10" />
  <rect id="engine-1" class="engine" x="10" y="80" width="6" height="6" />
</svg>`;

describe('svgLoader - team color regions', () => {
  it('extracts data-team regions and their roles', () => {
    const parsed = parseSvgForMounts(sampleSvg as any);
    expect(parsed).toBeDefined();
    expect(parsed.colorRegions).toBeDefined();
    const regions = parsed.colorRegions || [];
    const roles = regions.map(r => r.role).sort();
    expect(roles).toEqual(['accent', 'primary']);
    // ensure ids/classes are present where applicable
    const primary = regions.find(r => r.role === 'primary');
    expect(primary).toBeDefined();
    expect(primary?.id).toBe('hull');
    const accent = regions.find(r => r.role === 'accent');
    expect(accent).toBeDefined();
    expect(accent?.id).toBe('accentGroup');
  });
});
