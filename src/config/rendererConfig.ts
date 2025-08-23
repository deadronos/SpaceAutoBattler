export const RendererConfig = {
  preferred: 'canvas' as 'canvas' | 'webgl',
  allowUrlOverride: true,
  allowWebGL: true,
  // UI overlays configuration
  hpBar: { bg: '#222', fill: '#4caf50', w: 20, h: 4, dx: -10, dy: -12 },
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
