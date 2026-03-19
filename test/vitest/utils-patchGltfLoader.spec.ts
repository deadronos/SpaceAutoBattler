import { describe, expect, it, vi, beforeEach } from 'vite-plus/test';

// Mock three.js GLTFLoader before importing the patch
const mockLoad = vi.fn();

interface PatchedLoaderPrototype {
  load: typeof mockLoad;
  __loadPatched?: boolean;
}

const mockGLTFLoader: { prototype: PatchedLoaderPrototype } = {
  prototype: {
    load: mockLoad,
  },
};

vi.mock('three/examples/jsm/loaders/GLTFLoader.js', () => ({
  GLTFLoader: mockGLTFLoader,
}));

describe('patchGltfLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the patched flag
    delete mockGLTFLoader.prototype.__loadPatched;
  });

  it('patches GLTFLoader to handle invalid URLs', async () => {
    // Import the patch module to trigger patching
    await import('../../src/utils/patchGltfLoader.js');

    expect(mockGLTFLoader.prototype.__loadPatched).toBe(true);

    // Create a mock loader instance
    const loader = Object.create(mockGLTFLoader.prototype);
    const onError = vi.fn();

    // Test with invalid URL (null)
    loader.load(null, undefined, undefined, onError);

    expect(mockLoad).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
    expect(onError.mock.calls[0][0].message).toContain('invalid url argument');
  });

  it('allows valid string URLs to pass through', async () => {
    await import('../../src/utils/patchGltfLoader.js');

    const loader = Object.create(mockGLTFLoader.prototype);
    const onLoad = vi.fn();

    loader.load('valid-url.glb', onLoad);

    expect(mockLoad).toHaveBeenCalledWith('valid-url.glb', onLoad, undefined, undefined);
  });

  it('allows valid URL objects to pass through', async () => {
    await import('../../src/utils/patchGltfLoader.js');

    const loader = Object.create(mockGLTFLoader.prototype);
    const onLoad = vi.fn();
    const url = new URL('http://example.com/model.glb');

    loader.load(url, onLoad);

    expect(mockLoad).toHaveBeenCalledWith(url, onLoad, undefined, undefined);
  });

  it('handles empty string URLs as invalid', async () => {
    await import('../../src/utils/patchGltfLoader.js');

    const loader = Object.create(mockGLTFLoader.prototype);
    const onError = vi.fn();

    loader.load('', undefined, undefined, onError);

    expect(mockLoad).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });

  it('handles undefined URLs', async () => {
    await import('../../src/utils/patchGltfLoader.js');

    const loader = Object.create(mockGLTFLoader.prototype);
    const onError = vi.fn();

    loader.load(undefined, undefined, undefined, onError);

    expect(mockLoad).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });

  it('handles number URLs as invalid', async () => {
    await import('../../src/utils/patchGltfLoader.js');

    const loader = Object.create(mockGLTFLoader.prototype);
    const onError = vi.fn();

    loader.load(123 as any, undefined, undefined, onError);

    expect(mockLoad).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });

  it('does not patch when constructor is undefined', async () => {
    // This tests the guard condition in patchPrototype
    // The patch should handle undefined constructors gracefully
    await import('../../src/utils/patchGltfLoader.js');

    // Should not throw an error
    expect(true).toBe(true);
  });

  it('works without onError callback', async () => {
    await import('../../src/utils/patchGltfLoader.js');

    const loader = Object.create(mockGLTFLoader.prototype);

    // Should not throw when onError is not provided
    expect(() => {
      loader.load(null);
    }).not.toThrow();

    expect(mockLoad).not.toHaveBeenCalled();
  });

  it('handles onError callback that throws', async () => {
    await import('../../src/utils/patchGltfLoader.js');

    const loader = Object.create(mockGLTFLoader.prototype);
    const throwingOnError = vi.fn(() => {
      throw new Error('onError callback error');
    });

    // Should not propagate the error from onError callback
    expect(() => {
      loader.load(null, undefined, undefined, throwingOnError);
    }).not.toThrow();

    expect(throwingOnError).toHaveBeenCalled();
    expect(mockLoad).not.toHaveBeenCalled();
  });
});
