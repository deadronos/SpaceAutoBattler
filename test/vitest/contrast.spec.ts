import { describe, expect, it } from 'vite-plus/test';
import {
  compositeOver,
  contrastRatio,
  parseColor,
  relativeLuminance,
} from '../../src/utils/contrast.js';

/**
 * The HUD overlays sit on top of the WebGL scene, whose darkest-to-lightest
 * backdrop is a radial gradient from `#010104` (edges) to `#050a17` (centre).
 * Compositing over the *lighter* centre is the conservative (worst-case)
 * choice for light-on-dark text, so it is used as the base for every pair.
 */
const SCENE_BASE = '#050a17';

/** WCAG 2.x AA minimum contrast for normal-size body text. */
const AA_BODY = 4.5;

describe('contrast helpers', () => {
  it('parses 6-digit hex colours', () => {
    expect(parseColor('#e3f1ff')).toEqual({ r: 227, g: 241, b: 255, a: 1 });
  });

  it('expands 3-digit hex colours', () => {
    expect(parseColor('#abc')).toEqual({ r: 170, g: 187, b: 204, a: 1 });
  });

  it('parses rgb() and rgba() functional colours', () => {
    expect(parseColor('rgb(7, 15, 32)')).toEqual({ r: 7, g: 15, b: 32, a: 1 });
    expect(parseColor('rgba(7, 15, 32, 0.78)')).toEqual({
      r: 7,
      g: 15,
      b: 32,
      a: 0.78,
    });
  });

  it('rejects unsupported colour strings', () => {
    expect(() => parseColor('hsl(210, 100%, 50%)')).toThrow(/Unsupported/);
  });

  it('alpha-composites a foreground over an opaque background', () => {
    expect(compositeOver({ r: 255, g: 0, b: 0, a: 0.5 }, { r: 0, g: 0, b: 0 })).toEqual({
      r: 127.5,
      g: 0,
      b: 0,
    });
  });

  it('computes WCAG relative luminance for black and white', () => {
    expect(relativeLuminance({ r: 0, g: 0, b: 0 })).toBe(0);
    expect(relativeLuminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1, 10);
  });

  it('returns the full 21:1 range for black on white and 1:1 for identical colours', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#777777', '#777777')).toBeCloseTo(1, 10);
  });

  it('composites a translucent background over the supplied base', () => {
    // A 50% black overlay on pure white must match mid-grey against white.
    expect(contrastRatio('#000000', 'rgba(255, 255, 255, 0.5)', '#000000')).toBeCloseTo(
      contrastRatio('#000000', '#808080'),
      1,
    );
  });
});

interface ContrastPair {
  /** Human-readable location of the pair, with the source selector. */
  readonly label: string;
  /** Foreground (text) colour, including any effective opacity as alpha. */
  readonly fg: string;
  /** Background colour, including any effective alpha. */
  readonly bg: string;
}

/**
 * Documented text/background pairs used across the HUD. Each `bg` mirrors the
 * rendered panel colour and each `fg` folds the selector's opacity into alpha,
 * so the ratio reflects what the user actually sees over the scene.
 *
 * Purely graphical or disabled elements (progress bars, `:disabled` controls
 * at 0.35/0.45 opacity) are intentionally excluded: WCAG exempts disabled
 * controls and non-text content.
 */
const DOCUMENTED_PAIRS: readonly ContrastPair[] = [
  // src/styles/ai-debug.css — .ai-debug-overlay / .hint
  { label: '.ai-debug-overlay body text (#e3f1ff)', fg: '#e3f1ff', bg: 'rgba(6, 14, 32, 0.82)' },
  { label: '.ai-debug-title (#f8fbff)', fg: '#f8fbff', bg: 'rgba(6, 14, 32, 0.82)' },
  {
    label: '.ai-debug-meta (0.78)',
    fg: 'rgba(227, 241, 255, 0.78)',
    bg: 'rgba(6, 14, 32, 0.82)',
  },
  {
    label: '.ai-debug-kpis (0.8)',
    fg: 'rgba(227, 241, 255, 0.8)',
    bg: 'rgba(6, 14, 32, 0.82)',
  },
  {
    label: '.ai-debug-empty (0.7)',
    fg: 'rgba(227, 241, 255, 0.7)',
    bg: 'rgba(6, 14, 32, 0.82)',
  },
  { label: '.hint (0.65)', fg: 'rgba(227, 241, 255, 0.65)', bg: 'rgba(6, 14, 32, 0.82)' },

  // src/styles/hud-drawer.css — panels use --panel-bg
  {
    label: '.hud-toggle-drawer__description (0.7)',
    fg: 'rgba(219, 229, 255, 0.7)',
    bg: 'rgba(7, 15, 32, 0.78)',
  },
  {
    label: '.hud-toggle-drawer__title (0.8)',
    fg: 'rgba(237, 244, 255, 0.8)',
    bg: 'rgba(7, 15, 32, 0.78)',
  },
  {
    label: '.hud-toggle-drawer__simulation-settings-title (0.7)',
    fg: 'rgba(255, 255, 255, 0.7)',
    bg: 'rgba(7, 15, 32, 0.78)',
  },
  {
    label: '.hud-toggle-drawer__simulation-settings-note (0.6)',
    fg: 'rgba(219, 229, 255, 0.6)',
    bg: 'rgba(7, 15, 32, 0.78)',
  },

  // src/styles/hud.css — .hud-panel body text
  { label: '.hud-panel body text (#ecf4ff)', fg: '#ecf4ff', bg: 'rgba(12, 21, 38, 0.86)' },
  {
    label: '.hud-health-fallback (0.86)',
    fg: 'rgba(236, 244, 255, 0.86)',
    bg: 'rgba(12, 21, 38, 0.86)',
  },

  // src/components/progression-panel.css — .progression-panel
  { label: '.progression-panel body text (#eaeaea)', fg: '#eaeaea', bg: 'rgba(12, 12, 16, 0.9)' },
  {
    label: '.progression-panel__meta (0.85)',
    fg: 'rgba(234, 234, 234, 0.85)',
    bg: 'rgba(12, 12, 16, 0.9)',
  },
  {
    label: '.ship-progression-card__level (0.9)',
    fg: 'rgba(234, 234, 234, 0.9)',
    bg: 'rgba(12, 12, 16, 0.9)',
  },
  {
    label: '.progression-event__time (0.8)',
    fg: 'rgba(234, 234, 234, 0.8)',
    bg: 'rgba(12, 12, 16, 0.9)',
  },
  {
    label: '.progression-event__details (0.9)',
    fg: 'rgba(234, 234, 234, 0.9)',
    bg: 'rgba(12, 12, 16, 0.9)',
  },
  {
    label: '.progression-events--empty (0.8)',
    fg: 'rgba(234, 234, 234, 0.8)',
    bg: 'rgba(12, 12, 16, 0.9)',
  },
];

describe('documented HUD text/background pairs', () => {
  it.each(DOCUMENTED_PAIRS)('$label meets WCAG AA (>= 4.5:1)', ({ fg, bg }) => {
    expect(contrastRatio(fg, bg, SCENE_BASE)).toBeGreaterThanOrEqual(AA_BODY);
  });
});
