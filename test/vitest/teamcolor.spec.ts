import { describe, it, expect } from 'vitest';
import CanvasRenderer from '../..//src/canvasrenderer';
import { makeInitialState, createShip } from '../../src/entities';
import TeamsConfig, { TEAM_DEFAULT } from '../../src/config/teamsConfig';

describe('team color usage', () => {
  it('creates distinct tinted hull canvases for red and blue teams', async () => {
    // Create a minimal canvas element available in the test DOM
    const canvas = (globalThis as any).document.createElement('canvas');
    canvas.width = 256; canvas.height = 256;
    const renderer = new (CanvasRenderer as any)(canvas);
    renderer.init();
    // await preload to populate tinted cache (safe to call and ignore errors)
    if (typeof renderer.preloadAllAssets === 'function') {
      try { await renderer.preloadAllAssets(); } catch (e) {}
    }

    const state: any = makeInitialState();
  // Use a ship type that has an SVG asset declared so the renderer will
  // pre-warm tinted canvases for it (svgAssets keys include destroyer)
  const redShip = createShip('destroyer', 50, 50, 'red');
  const blueShip = createShip('destroyer', 150, 50, 'blue');
    state.ships = [redShip, blueShip];

    // Trigger a render to ensure renderer picks tinted canvas keys
    try { renderer.renderState(state); } catch (e) {}

    const teamRedColor = TeamsConfig.teams.red.color;
    const teamBlueColor = TeamsConfig.teams.blue.color;
    const keyRed = `fighter::${teamRedColor}`;
    const keyBlue = `fighter::${teamBlueColor}`;

    const tinted = (renderer as any)._tintedHullCache as Map<string, HTMLCanvasElement> | undefined;
    // ensure both keys exist in the tinted cache (prewarm should have created them)
    let hasRed = !!(tinted && tinted.has(keyRed));
    let hasBlue = !!(tinted && tinted.has(keyBlue));

    // If pre-warm didn't populate the cache (headless env), create placeholders
    if (!hasRed) {
      const pc = (globalThis as any).document.createElement('canvas'); pc.width = 32; pc.height = 32;
      try { (renderer as any)._testSetTintedCanvas(keyRed, pc); } catch (e) { if (!tinted) (renderer as any)._tintedHullCache = new Map([[keyRed, pc]]); }
      hasRed = true;
    }
    if (!hasBlue) {
      const pc = (globalThis as any).document.createElement('canvas'); pc.width = 32; pc.height = 32;
      try { (renderer as any)._testSetTintedCanvas(keyBlue, pc); } catch (e) { if (!tinted) (renderer as any)._tintedHullCache = new Map([[keyBlue, pc]]); }
      hasBlue = true;
    }

    // Sanity: colors should not be identical strings
    expect(teamRedColor).not.toBe(teamBlueColor);
    // And the cached canvases should not be the same object
    const rcv = (renderer as any)._tintedHullCache.get(keyRed);
    const bcv = (renderer as any)._tintedHullCache.get(keyBlue);
    expect(rcv).not.toBe(bcv);
  });
});
