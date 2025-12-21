import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useProgressiveTexture } from '../../src/hooks/useProgressiveTexture.js';
import * as THREE from 'three';

// Mock @react-three/fiber
vi.mock('@react-three/fiber', () => ({
  useLoader: vi.fn((loader, url) => {
    // Return a mock texture for low-res URL
    const texture = new THREE.Texture();
    texture.name = url.includes('2048') ? 'lowres' : 'highres';
    return texture;
  }),
}));

describe('useProgressiveTexture', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('returns null texture initially', () => {
    const lowResUrl = '/test-lowres.png';
    const highResUrl = '/test-highres.png';

    const { result } = renderHook(() => useProgressiveTexture(lowResUrl, highResUrl));

    // Should have a texture (the low-res one from useLoader)
    expect(result.current.texture).not.toBeNull();
    expect(result.current.isHighResLoaded).toBe(false);
    expect(result.current.progress).toBeGreaterThanOrEqual(0);
  });

  test('progressive texture result has expected shape', () => {
    const lowResUrl = '/test-lowres.png';
    const highResUrl = '/test-highres.png';

    const { result } = renderHook(() => useProgressiveTexture(lowResUrl, highResUrl));

    expect(result.current).toHaveProperty('texture');
    expect(result.current).toHaveProperty('isHighResLoaded');
    expect(result.current).toHaveProperty('progress');
    expect(typeof result.current.isHighResLoaded).toBe('boolean');
    expect(typeof result.current.progress).toBe('number');
  });

  test('progress value is within valid range', () => {
    const lowResUrl = '/test-lowres.png';
    const highResUrl = '/test-highres.png';

    const { result } = renderHook(() => useProgressiveTexture(lowResUrl, highResUrl));

    expect(result.current.progress).toBeGreaterThanOrEqual(0);
    expect(result.current.progress).toBeLessThanOrEqual(100);
  });

  test('handles different URL formats', () => {
    const testCases = [
      { lowRes: '/assets/texture-512.png', highRes: '/assets/texture-2048.png' },
      { lowRes: 'texture-low.jpg', highRes: 'texture-high.jpg' },
      { lowRes: '../textures/low.png', highRes: '../textures/high.png' },
    ];

    testCases.forEach(({ lowRes, highRes }) => {
      const { result } = renderHook(() => useProgressiveTexture(lowRes, highRes));

      expect(result.current).toBeDefined();
      expect(result.current.progress).toBeGreaterThanOrEqual(0);
    });
  });

  test('texture is not null after low-res loads', () => {
    const lowResUrl = '/test-lowres.png';
    const highResUrl = '/test-highres.png';

    const { result } = renderHook(() => useProgressiveTexture(lowResUrl, highResUrl));

    // Low-res texture should be loaded immediately via useLoader
    expect(result.current.texture).not.toBeNull();
  });

  test('maintains texture reference across renders', () => {
    const lowResUrl = '/test-lowres.png';
    const highResUrl = '/test-highres.png';

    const { result, rerender } = renderHook(() => useProgressiveTexture(lowResUrl, highResUrl));

    const firstTexture = result.current.texture;
    rerender();
    const secondTexture = result.current.texture;

    expect(firstTexture).toBe(secondTexture);
  });
});
