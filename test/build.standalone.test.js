import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('build: standalone output', () => {
  const rootStandalone = path.join(process.cwd(), 'space_themed_autobattler_canvas_red_vs_blue_standalone.html');

  it('outputs a standalone HTML at repo root', () => {
    const exists = fs.existsSync(rootStandalone);
    expect(exists).toBe(true);
  });

  it('inlines CSS bundle into the standalone html', () => {
    const src = fs.readFileSync(rootStandalone, 'utf8');
    // we expect the concatenated CSS marker or at least some CSS rules
    expect(src.includes('/* ui.css */') || /html, body \{/.test(src)).toBe(true);
    // check for a known class from the UI styles
    expect(src.includes('.btn')).toBe(true);
  });

  it('inlines JS bundle and includes key src symbols', () => {
    const src = fs.readFileSync(rootStandalone, 'utf8');
    // The bundler inlines source segments and usually preserves file markers like 'src/rng.js'
    expect(src.includes('src/rng.js') || src.includes('function srand')).toBe(true);
    // check for important exported functions/classes that should appear when src is bundled
    expect(src.includes('createShip')).toBe(true);
    expect(src.includes('createCanvasRenderer') || src.includes('createCanvasRenderer(')).toBe(true);
  });
});
