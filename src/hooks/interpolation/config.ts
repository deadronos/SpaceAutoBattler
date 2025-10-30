import { resolveRendererMotionConfig } from '../../config/renderer.js';
import type { MotionStats } from '../../types/gameplay.js';

export interface SmoothingConfig {
  positionK: number;
  rotationK: number;
  bankK: number;
  teleportThresholdSq: number;
  bankFactor: number;
  maxBankDeg: number;
  thrusterIntensity: { base: number; range: number };
}

export function createSmoothingConfig(motion: MotionStats): SmoothingConfig {
  const cfg = resolveRendererMotionConfig(motion);
  return {
    positionK: Math.max(0, cfg.positionK),
    rotationK: Math.max(0, cfg.rotationK),
    bankK: Math.max(0, cfg.bankK),
    teleportThresholdSq: Math.max(1, cfg.teleportDistance * cfg.teleportDistance),
    bankFactor: cfg.bankFactor,
    maxBankDeg: cfg.maxBankDeg,
    thrusterIntensity: cfg.thrusterIntensity,
  };
}
