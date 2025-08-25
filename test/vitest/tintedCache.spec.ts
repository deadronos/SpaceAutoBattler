import { describe, it, expect, beforeEach } from 'vitest';
import CanvasRenderer from '../../src/canvasrenderer';
import AssetsConfig from '../../src/config/assets/assetsConfig';
import TeamsConfig from '../../src/config/teamsConfig';
import TintedHullPool from '../../src/pools/tintedHullPool';

// Minimal DOM canvas stub is provided by happy-dom in the test environment
describe('CanvasRenderer tinted hull cache', () => {
  let canvas: HTMLCanvasElement;
  beforeEach(() => {
    // create a canvas element
    canvas = document.createElement('canvas');
    canvas.width = 200; canvas.height = 200;
    // Ensure AssetsConfig has at least one simple SVG entry for testing
    (AssetsConfig as any).svgAssets = (AssetsConfig as any).svgAssets || {};
    (AssetsConfig as any).svgAssets.testfighter = '<svg viewBox="0 0 128 128"><rect x="0" y="0" width="128" height="128" fill="#fff" /></svg>';
    // Add a shapes2d entry to avoid extent computation issues
    (AssetsConfig as any).shapes2d = (AssetsConfig as any).shapes2d || {};
    (AssetsConfig as any).shapes2d.testfighter = { type: 'circle', r: 10 };
    // Provide a minimal team config
    (TeamsConfig as any).teams = { red: { id: 'red', color: '#ff0000' }, blue: { id: 'blue', color: '#0000ff' } };
  });

  it('pre-warms tinted cache for known teams', async () => {
    const r = new CanvasRenderer(canvas);
    // small cap so test is deterministic: set pool caps explicitly
    (r as any)._tintedHullPool = new TintedHullPool({ globalCap: 8, perTeamCap: 4 });
    await (r as any).preloadAllAssets();
    // After preload, expect tinted pool to contain entries for the testfighter+teams
    const keys = (r as any)._tintedHullPool ? Array.from(((r as any)._tintedHullPool as TintedHullPool).keys()) : [];
    // diagnostic checks
    const declared = (AssetsConfig as any).svgAssets || {};
  // DEBUG: dump declared assets and renderer caches
  console.log('[test] declared svgAssets keys=', Object.keys(declared));
  const hulls = (r as any)._svgHullCache || {};
  console.log('[test] renderer _svgHullCache keys=', Object.keys(hulls));
  console.log('[test] renderer _tintedHullCache keys=', keys);
    expect(Object.keys(declared)).toContain('testfighter');
  // ensure svg hull cache contains rasterized canvas for the ship type
  expect(Object.keys(hulls)).toContain('testfighter');
    expect(keys.some(k => k.startsWith('testfighter::'))).toBe(true);
  });

  it('evicts LRU entries when cap exceeded and promotes on access', async () => {
    const r = new CanvasRenderer(canvas);
    // Use a small global cap to exercise eviction
    (r as any)._tintedHullPool = new TintedHullPool({ globalCap: 3, perTeamCap: 3 });
    // Manually populate svgHullCache to avoid async rasterization complexity
    const c1 = document.createElement('canvas'); c1.width = c1.height = 32;
    const c2 = document.createElement('canvas'); c2.width = c2.height = 32;
    const c3 = document.createElement('canvas'); c3.width = c3.height = 32;
    const c4 = document.createElement('canvas'); c4.width = c4.height = 32;
    (r as any)._svgHullCache = { a: c1, b: c2, c: c3, d: c4 };
    // create tinted entries
    // Use renderer helper which will populate the pool
    (r as any)._testSetTintedCanvas('a::#111', c1);
    (r as any)._testSetTintedCanvas('b::#111', c2);
    (r as any)._testSetTintedCanvas('c::#111', c3);
    // Access 'a' to promote it (becomes MRU) using pool API
    const pool = (r as any)._tintedHullPool as TintedHullPool;
    const ex = pool.get('a::#111');
    if (ex) { pool.delete('a::#111'); pool.set('a::#111', ex); }
    // Insert d, should evict the oldest (which should be 'b' now)
  r._testSetTintedCanvas('d::#111', c4);
    const keys = Array.from(pool.keys());
    expect(keys).not.toContain('b::#111');
    expect(keys).toContain('a::#111');
    expect(keys).toContain('c::#111');
    expect(keys).toContain('d::#111');
  });

  it('clearTintedHullCache clears the cache', () => {
    const r = new CanvasRenderer(canvas);
    (r as any)._tintedHullPool = new TintedHullPool({ globalCap: 10, perTeamCap: 5 });
    (r as any)._tintedHullPool.set('x::#1', document.createElement('canvas'));
    r.clearTintedHullCache();
    expect(((r as any)._tintedHullPool as TintedHullPool).size).toBe(0);
  });
});
