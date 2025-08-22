// Renderer preference configuration
// preferred: 'canvas' or 'webgl'
export const RendererConfig = {
  preferred: 'canvas',
  allowUrlOverride: true,
  allowWebGL: true
};

// A user-adjustable multiplier applied on top of devicePixelRatio to scale
// the renderer. Default is 1 (no additional scaling). Increasing this value
// will make the rendered scene appear larger (zoomed in).
RendererConfig.rendererScale = 1;

export function getPreferredRenderer() {
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
