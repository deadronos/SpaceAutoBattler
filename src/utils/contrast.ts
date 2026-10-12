/**
 * Pure WCAG 2.x contrast helpers.
 *
 * These functions are dependency-free and DOM-free so they can run both in the
 * app and inside unit tests. Colours may be supplied as hex strings
 * (`#rrggbb` / `#rgb`), `rgb()` / `rgba()` functional strings, or as plain
 * channel objects. Alpha is composited over the resolved background (and, for
 * translucent backgrounds, over an explicit base colour) before the ratio is
 * computed.
 */

export interface Rgb {
  /** Red channel in the 0-255 range. */
  r: number;
  /** Green channel in the 0-255 range. */
  g: number;
  /** Blue channel in the 0-255 range. */
  b: number;
}

export interface Rgba extends Rgb {
  /** Alpha in the 0-1 range. */
  a: number;
}

export type ColorInput = string | Rgb | Rgba;

const HEX_SHORT = /^#([0-9a-f]{3})$/i;
const HEX_LONG = /^#([0-9a-f]{6})$/i;
const RGB_FUNCTION = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i;

function clampChannel(value: number): number {
  return Math.min(255, Math.max(0, value));
}

function clampAlpha(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * Parse a colour into 0-255 RGB channels plus a 0-1 alpha channel.
 *
 * Throws for unrecognised input so misuse fails loudly instead of silently
 * producing an incorrect ratio.
 *
 * @param {ColorInput} input - Hex string, rgb()/rgba() string, or channel object.
 * @returns {Rgba} Normalised channels with alpha in the 0-1 range.
 */
export function parseColor(input: ColorInput): Rgba {
  if (typeof input !== 'string') {
    const alpha = 'a' in input ? input.a : 1;
    return {
      r: clampChannel(input.r),
      g: clampChannel(input.g),
      b: clampChannel(input.b),
      a: clampAlpha(alpha),
    };
  }

  const value = input.trim();

  const short = HEX_SHORT.exec(value);
  const shortDigits = short?.[1];
  if (shortDigits) {
    const [r, g, b] = shortDigits;
    return {
      r: parseInt(`${r}${r}`, 16),
      g: parseInt(`${g}${g}`, 16),
      b: parseInt(`${b}${b}`, 16),
      a: 1,
    };
  }

  const long = HEX_LONG.exec(value);
  const hex = long?.[1];
  if (hex) {
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
      a: 1,
    };
  }

  const fn = RGB_FUNCTION.exec(value);
  if (fn) {
    return {
      r: clampChannel(Number(fn[1])),
      g: clampChannel(Number(fn[2])),
      b: clampChannel(Number(fn[3])),
      a: fn[4] === undefined ? 1 : clampAlpha(Number(fn[4])),
    };
  }

  throw new Error(`Unsupported colour: ${input}`);
}

/**
 * Composite a foreground colour with alpha over an opaque background.
 *
 * @param {Rgba} foreground - Source colour, alpha in the 0-1 range.
 * @param {Rgb} background - Opaque destination colour.
 * @returns {Rgb} The blended, fully opaque colour.
 */
export function compositeOver(foreground: Rgba, background: Rgb): Rgb {
  const alpha = foreground.a;
  return {
    r: foreground.r * alpha + background.r * (1 - alpha),
    g: foreground.g * alpha + background.g * (1 - alpha),
    b: foreground.b * alpha + background.b * (1 - alpha),
  };
}

/**
 * Compute the WCAG 2.x relative luminance of an opaque colour.
 *
 * @param {Rgb} rgb - Colour with 0-255 channels.
 * @returns {number} Relative luminance in the 0-1 range.
 */
export function relativeLuminance(rgb: Rgb): number {
  const linearize = (value: number): number => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
  };

  return 0.2126 * linearize(rgb.r) + 0.7152 * linearize(rgb.g) + 0.0722 * linearize(rgb.b);
}

/**
 * Compute the WCAG 2.x contrast ratio between two colours.
 *
 * Translucent colours are alpha-composited: the background is first blended
 * over `base`, then the foreground is blended over that resolved background.
 *
 * @param {ColorInput} foreground - Text/element colour (may include alpha).
 * @param {ColorInput} background - Background colour (may include alpha).
 * @param {ColorInput} [base='#000000'] - Opaque colour behind a translucent background.
 * @returns {number} Contrast ratio between 1 and 21.
 */
export function contrastRatio(
  foreground: ColorInput,
  background: ColorInput,
  base: ColorInput = '#000000',
): number {
  const baseRgb = parseColor(base);
  const bg = parseColor(background);
  const resolvedBg = bg.a < 1 ? compositeOver(bg, baseRgb) : { r: bg.r, g: bg.g, b: bg.b };

  const fg = parseColor(foreground);
  const resolvedFg = fg.a < 1 ? compositeOver(fg, resolvedBg) : { r: fg.r, g: fg.g, b: fg.b };

  const foregroundLuminance = relativeLuminance(resolvedFg);
  const backgroundLuminance = relativeLuminance(resolvedBg);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);

  return (lighter + 0.05) / (darker + 0.05);
}
