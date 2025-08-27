import { describe, it, expect } from 'vitest';
import CanvasRenderer from '../../src/canvasrenderer';
import { makeInitialState, createShip } from '../../src/entities';
import TeamsConfig from '../../src/config/teamsConfig';

// Small helper to compute average RGB in a rectangle region of a canvas
function averageColorOfCanvasRegion(canvas: HTMLCanvasElement, x: number, y: number, w: number, h: number) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return { r: 0, g: 0, b: 0 };
  const data = ctx.getImageData(x, y, Math.max(1, w), Math.max(1, h)).data;
  let r = 0, g = 0, b = 0;
  const px = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    r += data[i]; g += data[i + 1]; b += data[i + 2];
  }
  return { r: r / px, g: g / px, b: b / px };
}

describe('integration: team-color pixel compare', () => {
  it('renders red and blue ships with distinguishable hull color averages', async () => {
    // create canvas and renderer
    const canvas = (globalThis as any).document.createElement('canvas');
    // keep it reasonably small for test speed while preserving resolution
    canvas.width = 400; canvas.height = 200;
    const renderer: any = new (CanvasRenderer as any)(canvas);
    renderer.init();

    // Build state with two ships: one red on left, one blue on right
    const state: any = makeInitialState();
    state.ships = [];
  const red = createShip('frigate', 100, 100, 0, 'red');
  const blue = createShip('frigate', 300, 100, 0, 'blue');
  // Increase radius so hull occupies a measurable pixel area for the test
  red.radius = 60;
  blue.radius = 60;
    state.ships.push(red, blue);

    // If the test environment doesn't provide a working 2D canvas, skip pixel compare
    const ctxTest = (globalThis as any).document.createElement('canvas').getContext && (globalThis as any).document.createElement('canvas').getContext('2d');
    if (!ctxTest) {
      // eslint-disable-next-line no-console
      console.warn('[integration_team_color_pixel] skipping pixel compare: no 2D canvas context available in test environment');
      return;
    }

    // Ensure preloadAllAssets is attempted so tinted placeholders exist
    if (typeof renderer.preloadAllAssets === 'function') {
      try { await renderer.preloadAllAssets(); } catch (e) {}
    }

    // Render state
    try { renderer.renderState(state); } catch (e) { /* ignore render errors */ }

    // Now sample a small rect around each ship
    const sampleW = 40; const sampleH = 40;
  // Sample on the main canvas (scaled copy of buffer) at ship positions to avoid huge buffer size
  const mainCanvas = renderer.canvas as HTMLCanvasElement;
  const scaleX = mainCanvas.width / (renderer.bufferCanvas.width || mainCanvas.width);
  const scaleY = mainCanvas.height / (renderer.bufferCanvas.height || mainCanvas.height);
  const redScreenX = Math.round(red.x * scaleX);
  const redScreenY = Math.round(red.y * scaleY);
  const blueScreenX = Math.round(blue.x * scaleX);
  const blueScreenY = Math.round(blue.y * scaleY);
  const redAvg = averageColorOfCanvasRegion(mainCanvas, Math.max(0, redScreenX - sampleW/2), Math.max(0, redScreenY - sampleH/2), sampleW, sampleH);
  const blueAvg = averageColorOfCanvasRegion(mainCanvas, Math.max(0, blueScreenX - sampleW/2), Math.max(0, blueScreenY - sampleH/2), sampleW, sampleH);

    // Convert hex color to RGB
    function hexToRgb(hex: string) {
      const m = /^#?([a-f0-9]{6})$/i.exec(hex);
      if (!m) return { r: 0, g: 0, b: 0 };
      const v = m[1];
      const r = parseInt(v.slice(0, 2), 16);
      const g = parseInt(v.slice(2, 4), 16);
      const b = parseInt(v.slice(4, 6), 16);
      return { r, g, b };
    }

    function dist(a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }) {
      const dr = a.r - b.r; const dg = a.g - b.g; const db = a.b - b.b;
      return Math.sqrt(dr * dr + dg * dg + db * db);
    }

    const teamRedColor = hexToRgb((TeamsConfig as any).teams.red.color || '#ff0000');
    const teamBlueColor = hexToRgb((TeamsConfig as any).teams.blue.color || '#0000ff');

    const redToRed = dist(redAvg, teamRedColor);
    const redToBlue = dist(redAvg, teamBlueColor);
    const blueToRed = dist(blueAvg, teamRedColor);
    const blueToBlue = dist(blueAvg, teamBlueColor);

    if (!(redToRed < redToBlue && blueToBlue < blueToRed)) {
      // eslint-disable-next-line no-console
      console.log('redAvg', redAvg, 'blueAvg', blueAvg, 'teamRed', teamRedColor, 'teamBlue', teamBlueColor, 'dists', { redToRed, redToBlue, blueToBlue, blueToRed });
    }

    expect(redToRed < redToBlue).toBe(true);
    expect(blueToBlue < blueToRed).toBe(true);
  }, 10000);
});
