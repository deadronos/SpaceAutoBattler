import { DISPLAY_DEFAULTS } from './displayConfig';

export const RendererConfig = {
  preferred: 'canvas' as 'canvas' | 'webgl',
  allowUrlOverride: true,
  allowWebGL: true,
  renderScale: DISPLAY_DEFAULTS.renderScale,
  displayScale: DISPLAY_DEFAULTS.displayScale,
  dynamicScaleEnabled: false,
  lastFrameTime: 0,
  frameScore: 'green', // green, yellow, red
  // UI overlays configuration
  hpBar: DISPLAY_DEFAULTS.hpBar,
};

export function getPreferredRenderer(): 'canvas' | 'webgl' {
  try {
    if (RendererConfig.allowUrlOverride && typeof window !== 'undefined' && window.location && window.location.search) {
      const p = new URLSearchParams(window.location.search);
      const r = p.get('renderer');
      if (r === 'canvas' || r === 'webgl') return r;
    }
  } catch (e) {}
  return RendererConfig.preferred;
}

export default RendererConfig;
