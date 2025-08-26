import { describe, it, expect, beforeEach } from 'vitest';
import { _clearRasterCache, cacheCanvasForAsset, setRasterCacheMaxEntries, _getRasterCacheKeysForTest } from '../../src/assets/svgRenderer';

describe('svgRenderer MRU cache behavior', () => {
  beforeEach(() => {
    _clearRasterCache();
    setRasterCacheMaxEntries(3);
  });

  it('promotes accessed entries to MRU and evicts oldest', () => {
    // create fake canvases
    const c1 = document.createElement('canvas'); c1.width = 8; c1.height = 8;
    const c2 = document.createElement('canvas'); c2.width = 8; c2.height = 8;
    const c3 = document.createElement('canvas'); c3.width = 8; c3.height = 8;
    const c4 = document.createElement('canvas'); c4.width = 8; c4.height = 8;

    // Use a unique prefix for keys so parallel tests don't interfere
    const prefix = 'test' + Math.floor(Math.random() * 1e9) + '::';
    const a = prefix + 'assetA';
    const b = prefix + 'assetB';
    const c = prefix + 'assetC';
    const d = prefix + 'assetD';

    // seed cache: keys will be inserted in order A,B,C
    cacheCanvasForAsset(a, {primary:'#111'}, 8,8, c1);
    cacheCanvasForAsset(b, {primary:'#222'}, 8,8, c2);
    cacheCanvasForAsset(c, {primary:'#333'}, 8,8, c3);

    let keys = _getRasterCacheKeysForTest().filter(k => k.includes(prefix));
    expect(keys.length).toBe(3);

    // Access assetA to promote it to MRU (simulate rasterize call path promotion)
    cacheCanvasForAsset(a, {primary:'#111'}, 8,8, c1);
    keys = _getRasterCacheKeysForTest().filter(k => k.includes(prefix));
    // assetA should now be last
    expect(keys[keys.length-1]).toContain('assetA');

    // Insert a 4th to force eviction; oldest (which should be assetB) should be removed
    cacheCanvasForAsset(d, {primary:'#444'}, 8,8, c4);
    const keysAfter = _getRasterCacheKeysForTest().filter(k => k.includes(prefix));
    expect(keysAfter.length).toBe(3);
    // assetA should still be present, assetB should have been evicted
    expect(keysAfter.find(k => k.includes('assetA'))).toBeTruthy();
    expect(keysAfter.find(k => k.includes('assetB'))).toBeUndefined();
  });
});
