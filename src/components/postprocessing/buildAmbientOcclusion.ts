import { N8AOPostPass } from 'n8ao';
import { Color, type Camera, type Scene } from 'three';
import type { AmbientOcclusionConfig } from '../../config/renderer.js';
import { reportWebGLError } from '../../utils/errorReporting.js';

export interface BuildAmbientOcclusionOptions {
  scene: Scene;
  camera: Camera;
  width: number;
  height: number;
  config: AmbientOcclusionConfig;
}

/**
 * Construct a half-res N8AO ambient-occlusion pass from configuration.
 *
 * Returns `null` when AO is disabled or when construction fails. The failure
 * path is intentional: under headless environments (jsdom/happy-dom, no WebGL)
 * constructing the pass throws, and callers should degrade to "no AO" rather
 * than break the composer.
 *
 * @param {BuildAmbientOcclusionOptions} options - Scene/camera/size plus AO config.
 * @returns {N8AOPostPass | null} The configured pass, or `null` when unavailable.
 */
export function buildAmbientOcclusion({
  scene,
  camera,
  width,
  height,
  config,
}: BuildAmbientOcclusionOptions): N8AOPostPass | null {
  if (!config.enabled) {
    return null;
  }

  try {
    const pass = new N8AOPostPass(scene, camera, width, height);
    pass.setQualityMode(config.quality);
    pass.configuration.halfRes = config.halfRes;
    pass.configuration.aoRadius = config.aoRadius;
    pass.configuration.distanceFalloff = config.distanceFalloff;
    pass.configuration.intensity = config.intensity;
    pass.configuration.color = new Color(config.color);
    // Defaults to `false`: N8AO's auto-detection would enable transparency-aware
    // mode for this scene (many transparent objects) and render the scene twice
    // more per frame. The knob stays overridable for future visual review.
    pass.configuration.transparencyAware = config.transparencyAware ?? false;
    return pass;
  } catch (error) {
    // Debug-gated diagnostic (counts always, logs only in development) so a real
    // N8AO failure is not silently swallowed; quiet under tests.
    reportWebGLError('buildAmbientOcclusion', error);
    return null;
  }
}
