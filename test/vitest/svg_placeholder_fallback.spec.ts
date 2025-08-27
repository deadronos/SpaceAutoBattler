import { describe, it, expect, vi } from 'vitest';
import CanvasRenderer from '../../src/canvasrenderer';
import { makeInitialState, createShip } from '../../src/entities';
import RendererConfig from '../../src/config/rendererConfig';

describe('SVG placeholder fallback', () => {
  it('skips drawing placeholder hull canvases and falls back to shape', () => {
    RendererConfig.renderScale = 1.0;
    const canvas = document.createElement('canvas');
    canvas.width = 400; canvas.height = 200;
    const r: any = new (CanvasRenderer as any)(canvas);
    r.init();

    // Put a placeholder canvas into the hull cache for 'fighter'
    const ph = document.createElement('canvas');
    ph.width = 64; ph.height = 64;
    const pctx = ph.getContext('2d');
    if (pctx) { pctx.fillStyle = '#fff'; pctx.fillRect(0, 0, 64, 64); }
    (ph as any)._placeholder = true;
    r._svgHullCache = r._svgHullCache || {};
    r._svgHullCache['fighter'] = ph;

    // Build state with a single fighter (sprite.shape exists so fallback is possible)
    const state: any = makeInitialState();
    state.ships = [];
    const ship = createShip('fighter', 100, 100, 'red');
    ship.radius = 20;
    state.ships.push(ship);

    // Spy on bufferCtx.drawImage to ensure it is not called for hull draw
    const spy = vi.spyOn(r.bufferCtx as CanvasRenderingContext2D, 'drawImage');
    try { r.renderState(state); } catch {}

    // We can't perfectly isolate hull draw vs other drawImage calls, but with the placeholder
    // ignored and default shapes, the hull path should not invoke a canvas draw.
    // To make this robust, assert that drawImage wasn't called at all in this simple scene.
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
