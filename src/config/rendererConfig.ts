import { DISPLAY_DEFAULTS } from "./displayConfig";

export const RendererConfig = {
  preferred: "three" as "three", // 3D is now mandatory and default
  allowUrlOverride: false, // Disable URL override for 2D renderers
  allowWebGL: false, // Disable WebGL renderer
  renderScale: DISPLAY_DEFAULTS.renderScale,
  displayScale: DISPLAY_DEFAULTS.displayScale,
  dynamicScaleEnabled: false,
  lastFrameTime: 0,
  frameScore: "green", // green, yellow, red
  // UI overlays configuration
  hpBar: DISPLAY_DEFAULTS.hpBar,
  // starfield rendering tweaks
  starfield: {
    parallaxFactor: 0.01, // how much the starfield moves relative to camera (0 = static)
    density: 0.00035, // base star density multiplier (stars = size*size*density)
    bloomIntensity: 0.9, // applied alpha when compositing bloom on canvas
  },
};

export function getPreferredRenderer(): "three" {
  // 3D renderer is now mandatory - no URL override or fallback options
  return "three";
}

export default RendererConfig;
