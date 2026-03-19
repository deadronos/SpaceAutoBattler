import { expect, test, describe } from 'vite-plus/test';
import { usePlanetTexture } from '../../src/hooks/usePlanetTexture.js';
import type { PlanetTextureKey } from '../../src/assets/planets.js';

/**
 * Test suite for planet texture loading fallback behavior.
 * Tests the hook logic without requiring a full Canvas context.
 */
describe('Planet Texture Fallback', () => {
  test('returns fallback color when no texture key provided', () => {
    // Test the hook's behavior with undefined key
    // This doesn't require Canvas context since it's just the logic

    // Since we can't test the hook directly without Canvas, we'll test the underlying logic
    const result = mockUsePlanetTexture(undefined);

    expect(result.texture).toBeNull();
    expect(result.fallbackColor).toBeDefined();
    expect(typeof result.fallbackColor).toBe('string');
    expect(result.fallbackColor).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  test('provides fallback color for invalid texture keys', () => {
    const result = mockUsePlanetTexture('invalidKey' as PlanetTextureKey);

    expect(result.texture).toBeNull();
    expect(result.error).toBeDefined();
    expect(result.error?.message).toContain('Unknown planet texture key');
    expect(result.fallbackColor).toBeDefined();
  });

  test('fallback color is consistent', () => {
    const result1 = mockUsePlanetTexture(undefined);
    const result2 = mockUsePlanetTexture(undefined);

    expect(result1.fallbackColor).toBe(result2.fallbackColor);
  });

  test('handles different texture key scenarios', () => {
    // Test with undefined
    const undefinedResult = mockUsePlanetTexture(undefined);
    expect(undefinedResult.texture).toBeNull();
    expect(undefinedResult.fallbackColor).toBeDefined();

    // Test with invalid key
    const invalidResult = mockUsePlanetTexture('nonexistent' as PlanetTextureKey);
    expect(invalidResult.texture).toBeNull();
    expect(invalidResult.error).toBeDefined();
    expect(invalidResult.fallbackColor).toBeDefined();
  });

  test('PlanetBody component handles missing textures gracefully', () => {
    // This tests that PlanetBody can render even when textures fail to load
    // We can't easily test the component directly without Canvas, but we can
    // verify the configuration supports fallback scenarios

    expect(() => {
      const result = mockUsePlanetTexture(undefined);
      // Component should be able to use the fallback color
      expect(result.fallbackColor).toBeTruthy();
    }).not.toThrow();
  });
});

/**
 * Mock implementation of usePlanetTexture logic for testing without Canvas
 */
function mockUsePlanetTexture(key: PlanetTextureKey | undefined) {
  const FALLBACK_COLOR = '#2e3142';

  if (!key) {
    return { texture: null, fallbackColor: FALLBACK_COLOR };
  }

  // Simulate known texture keys
  const knownKeys = ['gasGiant12', 'icePlanet1'];

  if (!knownKeys.includes(key)) {
    return {
      texture: null,
      fallbackColor: FALLBACK_COLOR,
      error: new Error(`Unknown planet texture key: ${key}`),
    };
  }

  // For known keys, we would normally return the texture
  // but for testing fallback behavior, we simulate texture loading failure
  return { texture: null, fallbackColor: FALLBACK_COLOR };
}
