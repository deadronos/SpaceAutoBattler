import { MathUtils } from 'three';
import { RENDERER_VISUAL_CONFIG } from '../../config/renderer.js';
import type { MotionVisualConfig } from '../../types/gameplay.js';
import type { SmoothingConfig } from './config.js';
import type { InterpolationState } from './state.js';
import { kToAlpha } from './math.js';

export function shouldApplyVisualSmoothing(visualCfg?: MotionVisualConfig): boolean {
  const globalVisualEnabled = RENDERER_VISUAL_CONFIG.enableShipVisualSmoothing;
  const visualEnabled = visualCfg?.enabled ?? true;
  return globalVisualEnabled && visualEnabled;
}

export function smoothVisualPosition(
  state: InterpolationState,
  visualCfg: MotionVisualConfig | undefined,
  smoothing: SmoothingConfig,
  dt: number,
): void {
  const posAlpha = kToAlpha(visualCfg?.position?.k ?? smoothing.positionK, dt);
  if (posAlpha <= 0 || posAlpha >= 1) {
    state.visualPosition.copy(state.targetVisualPosition);
    return;
  }

  state.visualPosition.lerp(state.targetVisualPosition, MathUtils.clamp(posAlpha, 0, 1));
}

export function smoothVisualRotation(
  state: InterpolationState,
  visualCfg: MotionVisualConfig | undefined,
  smoothing: SmoothingConfig,
  dt: number,
): void {
  const rotAlpha = kToAlpha(visualCfg?.rotation?.k ?? smoothing.rotationK, dt);
  if (rotAlpha <= 0 || rotAlpha >= 1) {
    state.visualRotation.copy(state.interpRotation);
    return;
  }

  state.visualRotation.slerp(state.interpRotation, MathUtils.clamp(rotAlpha, 0, 1));
}
