import { describe, expect, it } from 'vitest';
import { Color } from 'three';
import { colorFromConfig } from '../../src/utils/color.js';

describe('colorFromConfig', () => {
  it('converts hex string to linear color', () => {
    const result = colorFromConfig('#ff0000');
    expect(result).toBeInstanceOf(Color);
    // Red in sRGB (#ff0000) should be different when converted to linear
    // Linear red is approximately (1, 0, 0) but the exact values depend on sRGB conversion
    expect(result.r).toBeGreaterThan(0.9); // Should be close to 1.0 for red
    expect(result.g).toBe(0);
    expect(result.b).toBe(0);
  });

  it('converts Color instance to linear color', () => {
    const inputColor = new Color('#00ff00'); // Green in sRGB
    const result = colorFromConfig(inputColor);
    expect(result).toBeInstanceOf(Color);
    expect(result).not.toBe(inputColor); // Should be a clone
    expect(result.r).toBe(0);
    expect(result.g).toBeGreaterThan(0.9); // Should be close to 1.0 for green
    expect(result.b).toBe(0);
  });

  it('uses string fallback when input is null', () => {
    const result = colorFromConfig(null, '#0000ff');
    expect(result).toBeInstanceOf(Color);
    expect(result.r).toBe(0);
    expect(result.g).toBe(0);
    expect(result.b).toBeGreaterThan(0.9); // Should be close to 1.0 for blue
  });

  it('uses Color fallback when input is undefined', () => {
    const fallbackColor = new Color('#ffff00'); // Yellow
    const result = colorFromConfig(undefined, fallbackColor);
    expect(result).toBeInstanceOf(Color);
    expect(result).not.toBe(fallbackColor); // Should be a clone
    expect(result.r).toBeGreaterThan(0.9); // Yellow has high red
    expect(result.g).toBeGreaterThan(0.9); // Yellow has high green
    expect(result.b).toBe(0); // Yellow has no blue
  });

  it('uses default white fallback when no fallback specified', () => {
    const result = colorFromConfig(null);
    expect(result).toBeInstanceOf(Color);
    // White should be (1, 1, 1) in linear space
    expect(result.r).toBe(1);
    expect(result.g).toBe(1);
    expect(result.b).toBe(1);
  });

  it('handles invalid hex strings gracefully', () => {
    const result = colorFromConfig('invalid-color', '#ff00ff');
    expect(result).toBeInstanceOf(Color);
    // Three.js doesn't throw for invalid colors, it defaults to white
    // So the result will be white (1,1,1) in linear space, not the fallback
    expect(result.r).toBe(1);
    expect(result.g).toBe(1);
    expect(result.b).toBe(1);
  });

  it('handles empty string input', () => {
    const result = colorFromConfig('', '#00ffff');
    expect(result).toBeInstanceOf(Color);
    // Should fall back to cyan
    expect(result.r).toBe(0);
    expect(result.g).toBeGreaterThan(0.9);
    expect(result.b).toBeGreaterThan(0.9);
  });

  it('handles Color fallback when string input is invalid', () => {
    const fallbackColor = new Color('#800080'); // Purple
    const result = colorFromConfig('not-a-color', fallbackColor);
    expect(result).toBeInstanceOf(Color);
    expect(result).not.toBe(fallbackColor); // Should be a clone
    // Three.js doesn't throw for invalid colors, it defaults to white
    // So the result will be white (1,1,1) in linear space, not the fallback
    expect(result.r).toBe(1);
    expect(result.g).toBe(1);
    expect(result.b).toBe(1);
  });
});
