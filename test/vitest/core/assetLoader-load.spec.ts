import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
// tests run in Vitest environment; we'll import the module dynamically inside each test


describe('assetLoader dynamic load', () => {
  beforeEach(() => {
    vi.resetModules();
    // Register a non-hoisted mock for the GLTFLoader so it is applied before
    // importing the module under test. vi.doMock is used to avoid hoisting
    // issues with dynamic module names.
    if (typeof vi.doMock === 'function') {
      vi.doMock('three/examples/jsm/loaders/GLTFLoader.js', () => {
        return {
          GLTFLoader: class {
            load(url: string, onLoad: (g: unknown) => void, _onProgress?: unknown, onError?: (e: unknown) => void) {
              if (url.includes('err')) {
                onError?.(new Error('mock load failure'));
              } else {
                onLoad({ scene: { loaded: true, url } });
              }
            }
          }
        };
      });
    } else {
      // Fallback to vi.mock if doMock unavailable
      vi.mock('three/examples/jsm/loaders/GLTFLoader.js', () => ({
        GLTFLoader: class {
          load(url: string, onLoad: (g: unknown) => void, _onProgress?: unknown, onError?: (e: unknown) => void) {
            if (url.includes('err')) {
              onError?.(new Error('mock load failure'));
            } else {
              onLoad({ scene: { loaded: true, url } });
            }
          }
        }
      }));
    }
  });
  afterEach(() => {
    // ensure any module mocks are cleared for other tests
    vi.clearAllMocks();
  });

  it('loads asset when not cached and stores in assetPool', async () => {
  const { loadGLTF } = await import('../../../src/core/assetLoader.js');
  const state: any = { assetPool: new Map<string, unknown>() };
    const url = '/models/test-model.gltf';
    const res = await loadGLTF(state, url);
    expect(res.url).toBe(url);
    // loader returns object with scene.loaded
    // stored in pool
    expect(res.data).toBeDefined();
    expect((res.data as unknown as { scene?: { loaded?: boolean } }).scene?.loaded).toBe(true);
    // assert stored in pool
  expect((state as unknown as { assetPool: Map<string, unknown> }).assetPool.get(url)).toBe(res.data);
  });

  it('rejects when loader reports error', async () => {
  const { loadGLTF } = await import('../../../src/core/assetLoader.js');
  const state: any = { assetPool: new Map<string, unknown>() };
    const url = '/models/err-model.gltf';
    await expect(loadGLTF(state, url)).rejects.toThrow('mock load failure');
  });
});
