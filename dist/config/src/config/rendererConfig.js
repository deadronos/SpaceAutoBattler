import { DISPLAY_DEFAULTS } from "./displayConfig";
export const RendererConfig = {
    preferred: "canvas",
    allowUrlOverride: true,
    allowWebGL: true,
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
export function getPreferredRenderer() {
    try {
        if (RendererConfig.allowUrlOverride &&
            typeof window !== "undefined" &&
            window.location &&
            window.location.search) {
            const p = new URLSearchParams(window.location.search);
            const r = p.get("renderer");
            if (r === "canvas" || r === "webgl")
                return r;
        }
    }
    catch (e) { }
    return RendererConfig.preferred;
}
export default RendererConfig;
