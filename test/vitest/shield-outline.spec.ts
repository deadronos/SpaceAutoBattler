import { describe, it, expect } from 'vitest';
import CanvasRenderer from '../../src/canvasrenderer';
import AssetsConfig from '../../src/config/assets/assetsConfig';

// Verify shield outline drawing does not throw in headless environment
describe('CanvasRenderer shield outline', () => {
  it('renders shield outline for polygon shapes without throwing', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 256;
    // Provide a simple polygon shape for a test ship
    (AssetsConfig as any).shapes2d = (AssetsConfig as any).shapes2d || {};
    (AssetsConfig as any).shapes2d.testship = { type: 'polygon', points: [[1,0], [0,1], [-1,0], [0,-1]] };
    const r = new CanvasRenderer(canvas);
    // create a minimal state with one ship that has shield
    const state: any = { ships: [ { x: 128, y: 128, angle: 0, radius: 12, shield: 1, maxShield: 1, type: 'testship' } ] };
    // Should not throw
    expect(() => r.renderState(state)).not.toThrow();
  });
});
