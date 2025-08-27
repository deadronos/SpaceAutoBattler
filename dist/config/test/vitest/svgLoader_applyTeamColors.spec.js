import { applyTeamColorsToSvg } from '../../src/assets/svgLoader';
describe('applyTeamColorsToSvg', () => {
    test('applies glow color to elements with data-team-slot="glow"', () => {
        const svg = `
      <svg width="100" height="100" viewBox="0 0 100 100">
        <rect width="100" height="100" fill="#000"/>
        <ellipse cx="30" cy="90" rx="6" ry="3" fill="#79ffe7" class="engine-glow" data-team-slot="glow"/>
        <ellipse cx="70" cy="90" rx="6" ry="3" fill="#79ffe7" class="engine-glow" data-team-slot="glow"/>
      </svg>
    `;
        const mapping = { glow: '#ff00ff' };
        const out = applyTeamColorsToSvg(svg, mapping, { applyTo: 'fill' });
        // assert that the resulting SVG has fill="#ff00ff" on the glow ellipses
        expect(out).toContain('data-team-slot="glow"');
        expect(out).toContain('fill="#ff00ff"');
        // style attribute should also include the fill
        expect(out).toMatch(/style=["'][^"']*fill:\s*#ff00ff/);
    });
});
