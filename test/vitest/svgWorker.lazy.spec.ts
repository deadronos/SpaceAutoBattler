import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RendererConfig } from '../../src/config/rendererConfig.js';
import { getSVGLoader, loadSVGAsset } from '../../src/core/svgLoader.js';

describe('SVG worker lazy initialization', () => {
  let origWorker: any;

  beforeEach(() => {
    // Preserve original Worker and replace with spy
    origWorker = (global as any).Worker;
    (global as any).Worker = vi.fn(function WorkerMock(...args: any[]) {
      // Simulate minimal Worker API used by SVGLoader
      this.postMessage = vi.fn();
      this.addEventListener = vi.fn();
      this.removeEventListener = vi.fn();
      this.terminate = vi.fn();
    }) as any;
  // Provide OffscreenCanvas and createImageBitmap to satisfy SVGLoader feature checks
  (global as any).OffscreenCanvas = class OffscreenCanvasMock {};
  (global as any).createImageBitmap = vi.fn(async () => ({} as any));
  });

  afterEach(() => {
    // Restore Worker
    (global as any).Worker = origWorker;
    // Reset RendererConfig to defaults (do not persist between tests)
    try { (RendererConfig as any).loadGltfModels = false; } catch { /* ignore */ }
    vi.resetAllMocks();
  });

  it('does NOT create SVG Worker when GLTF mode is enabled', async () => {
    try { (RendererConfig as any).loadGltfModels = true; } catch { /* ignore */ }

    // Accessing the SVG loader or calling preloads should not instantiate a Worker
    const loader = getSVGLoader();

    // The SVGLoader constructor no longer eagerly creates the worker; ensure Worker was not called
    expect((global as any).Worker).not.toHaveBeenCalled();

    // Also ensure that calling a non-rasterizing method (getAsset/getCacheStats) doesn't create a worker
    loader.getCacheStats();
    expect((global as any).Worker).not.toHaveBeenCalled();
  });

  it('initializes SVG Worker lazily when rasterization is requested and GLTF disabled', async () => {
    try { (RendererConfig as any).loadGltfModels = false; } catch { /* ignore */ }

    // Ensure Worker not yet created
    expect((global as any).Worker).not.toHaveBeenCalled();

    // Trigger rasterization path by requesting an asset with size (this calls loadSVGAsset -> rasterize)
    // Use a dummy inline SVG via global.__INLINE_SVG_ASSETS to avoid network fetch
    (global as any).__INLINE_SVG_ASSETS = { 'test-inline': '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="#fff"/></svg>' };
    const url = 'src/config/assets/svg/test-inline.svg';

    // Call loadSVGAsset which should lazily initialize the worker (or at least attempt to)
    try {
      await loadSVGAsset(url, { width: 16, height: 16 });
    } catch (_e) {
      // Rasterization may fall back to main-thread in the test env; we only assert Worker creation attempt
    }

    // Worker should have been constructed (or at least attempted)
    expect((global as any).Worker).toHaveBeenCalled();
  });
});
