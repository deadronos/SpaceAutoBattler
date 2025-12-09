import { Color } from 'three';

/**
 * Accepted color shapes for configuration inputs: a hex string or a Three.js Color.
 * Use this type when a config value can be either form.
 */
export type ColorConfig = string | Color;

/**
 * Convert a configuration color (hex string or Color) from sRGB into a linear Color
 * suitable for shader math and uniforms. If input is falsy or invalid, the fallback
 * (string or Color) will be used instead.
 *
 * @param {ColorConfig | null} [input] - Color provided by config (hex string or Color).
 * @param {ColorConfig} [fallback='#ffffff'] - Fallback value used when input is falsy or invalid.
 * @returns {Color} A new Three.js Color in linear color space ready for shader uniforms.
 */
export function colorFromConfig(
  input?: ColorConfig | null,
  fallback: ColorConfig = '#ffffff',
): Color {
  // Helper to convert a Color instance to linear safely
  const toLinear = (c: Color) => c.clone().convertSRGBToLinear();

  if (!input) {
    // fallback may be a Color or a hex string
    return typeof fallback === 'string'
      ? new Color(fallback).convertSRGBToLinear()
      : toLinear(fallback);
  }

  try {
    if (typeof input === 'string') {
      return new Color(input).convertSRGBToLinear();
    }
    return toLinear(input);
  } catch {
    return typeof fallback === 'string'
      ? new Color(fallback).convertSRGBToLinear()
      : toLinear(fallback);
  }
}
