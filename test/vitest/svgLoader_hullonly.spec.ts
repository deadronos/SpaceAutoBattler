import { describe, it, expect } from 'vitest';
import { rasterizeHullOnlySvgToCanvas, parseSvgForMounts } from '../../src/assets/svgLoader';

const frigateSvg = `<svg width="128" height="128" viewBox="0 0 128 128">
  <rect width="128" height="128" fill="#0d1622"/>
  <!-- Main hull -->
  <rect x="44" y="20" width="40" height="88" rx="18" fill="#6df6ff" stroke="#497ca3" stroke-width="3"/>
  <!-- Cockpit -->
  <ellipse cx="64" cy="38" rx="10" ry="14" fill="#bdf6ff" stroke="#3ac4e6" stroke-width="2"/>
  <!-- Hull detailing -->
  <rect x="54" y="55" width="20" height="40" rx="6" fill="#2a9fbb" opacity="0.8"/>
  <rect x="50" y="80" width="28" height="12" rx="6" fill="#2abfff" opacity="0.5"/>
  <!-- Engine glows -->
  <ellipse cx="56" cy="112" rx="4" ry="2" fill="#53ffd8"/>
  <ellipse cx="72" cy="112" rx="4" ry="2" fill="#53ffd8"/>
  <!-- 2 Turrets -->
  <rect x="57" y="22" width="6" height="14" rx="2" fill="#fff" class="turret" />
  <rect x="65" y="22" width="6" height="14" rx="2" fill="#fff" class="turret" />
  <!-- Tech panels -->
  <rect x="58" y="62" width="12" height="5" rx="2" fill="#fff" opacity="0.2"/>
  <rect x="58" y="70" width="12" height="5" rx="2" fill="#fff" opacity="0.2"/>
</svg>`;

describe('svgLoader hull-only rasterization and mountpoint extraction', () => {
  it('extracts turret mountpoints from class="turret" rects', () => {
    const result = parseSvgForMounts(frigateSvg);
    expect(result.mounts.length).toBe(2);
    // Should be near the turret rects' centers
    expect(result.mounts[0].x).toBeGreaterThan(56);
    expect(result.mounts[1].x).toBeGreaterThan(64);
  });

  it('extracts engine mountpoints from class="engine" rects', () => {
    // Add engine mountpoints to SVG for test
    const engineSvg = frigateSvg.replace('</svg>', '<rect x="54" y="110" width="4" height="6" rx="2" fill="#53ffd8" class="engine" /><rect x="70" y="110" width="4" height="6" rx="2" fill="#53ffd8" class="engine" /></svg>');
    const result = parseSvgForMounts(engineSvg);
    expect(result.engineMounts.length).toBe(2);
    // Should be near the engine rects' centers
    expect(result.engineMounts[0].x).toBeGreaterThan(53);
    expect(result.engineMounts[1].x).toBeGreaterThan(69);
  });

  it('rasterizes hull-only SVG without turret rects', () => {
    const canvas = rasterizeHullOnlySvgToCanvas(frigateSvg, 128, 128);
    // Should be a canvas of correct size
    expect(canvas.width).toBe(128);
    expect(canvas.height).toBe(128);
    // We can't pixel-inspect here, but the function should succeed
  });
});
