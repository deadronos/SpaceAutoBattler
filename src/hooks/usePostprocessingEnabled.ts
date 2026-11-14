import { useUiStore } from '../app/uiStore.js';
import { resolvePostprocessingEnabled, resolveQualitySettings } from '../config/quality.js';

type DebugWindow = Window & {
  __copilot_forcePostprocessingMount?: boolean;
};

/**
 * Resolve whether the postprocessing composer should be active, combining the
 * UI toggle, the quality preset's bloom ceiling, and the debug mount override.
 *
 * @returns {boolean} True when postprocessing is active for the current frame.
 */
export function usePostprocessingEnabled(): boolean {
  const qualityPreset = useUiStore((s) => s.qualityPreset);
  const detectedQualityTier = useUiStore((s) => s.detectedQualityTier);
  const uiPost = useUiStore((s) => s.postprocessingEnabled);
  const quality = resolveQualitySettings(qualityPreset, detectedQualityTier);
  const forceMount =
    typeof window !== 'undefined' &&
    (window as DebugWindow).__copilot_forcePostprocessingMount === true;

  return resolvePostprocessingEnabled(uiPost, quality.bloom, forceMount);
}
