import { describe, it, expect } from 'vitest';
import CanvasRenderer from '../../src/canvasrenderer';
import { makeInitialState, createShip } from '../../src/entities';
import RendererConfig from '../../src/config/rendererConfig';
import { getDefaultBounds } from '../../src/config/simConfig';
function getPixel(canvas, x, y) {
    const ctx = canvas.getContext('2d');
    if (!ctx)
        return [0, 0, 0, 0];
    const d = ctx.getImageData(Math.max(0, x), Math.max(0, y), 1, 1).data;
    return [d[0], d[1], d[2], d[3]];
}
describe('UI bars orientation', () => {
    it('HP/shield bars do not rotate with ship angle', () => {
        // Configure renderer
        RendererConfig.renderScale = 1.0;
        const { W, H } = getDefaultBounds();
        const canvas = document.createElement('canvas');
        canvas.width = W;
        canvas.height = H;
        const renderer = new CanvasRenderer(canvas);
        renderer.init();
        // If the test environment doesn't provide a working 2D canvas, skip pixel compare
        const ctxTest = globalThis.document.createElement('canvas').getContext && globalThis.document.createElement('canvas').getContext('2d');
        if (!ctxTest) {
            // eslint-disable-next-line no-console
            console.warn('[ui_bars_orientation] skipping pixel compare: no 2D canvas context available in test environment');
            return;
        }
        // Force a flat, known background to differentiate bars
        const bg = renderer.bufferCtx;
        if (bg) {
            bg.save();
            bg.setTransform(1, 0, 0, 1, 0, 0);
            bg.fillStyle = '#000000';
            bg.fillRect(0, 0, canvas.width, canvas.height);
            bg.restore();
        }
        // Create a ship in the center with visible bars
        const state = makeInitialState();
        state.ships = [];
        const ship = createShip('fighter', W / 2, H / 2, 'red');
        ship.radius = 30; // make bars larger
        ship.hp = ship.maxHp = 100;
        ship.shield = ship.maxShield = 50;
        state.ships.push(ship);
        // Helper to render and sample pixel above ship center where bars should be
        const sample = () => {
            renderer.renderState(state);
            // Copy happens to main canvas, sample there for simplicity
            const sx = Math.round(ship.x);
            // Bars drawn above the ship by dy; use a small offset upwards
            const r = ship.radius || 12;
            const sy = Math.round(ship.y - r - 12);
            return getPixel(renderer.canvas, sx, sy);
        };
        // Angle 0
        ship.angle = 0;
        const px0 = sample();
        // Rotate ship by 90 degrees; bars should remain at same screen spot
        ship.angle = Math.PI / 2;
        const px90 = sample();
        // Both samples should differ from pure background and be similar to each other
        const isBg = (p) => p[0] === 0 && p[1] === 0 && p[2] === 0 && p[3] === 0;
        expect(isBg(px0)).toBe(false);
        expect(isBg(px90)).toBe(false);
        const diff = Math.abs(px0[0] - px90[0]) + Math.abs(px0[1] - px90[1]) + Math.abs(px0[2] - px90[2]);
        expect(diff).toBeLessThan(40); // colors should be close across rotations
    });
});
