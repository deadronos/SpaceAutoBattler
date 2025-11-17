import type { MotionStats } from '../types/index.js';

export interface RendererMotionConfig {
  /** Position smoothing time-constant used as a fallback when hull config omits one. */
  positionK: number;
  /** Rotation smoothing time-constant used as a fallback when hull config omits one. */
  rotationK: number;
  /** Banking smoothing time-constant used as a fallback when hull config omits one. */
  bankK: number;
  /** Maximum bank angle allowed for visuals (degrees). */
  maxBankDeg: number;
  /** Conversion factor from yaw rate (rad/s) to bank degrees. */
  bankFactor: number;
  /** Distance threshold (units) that resets interpolation to avoid trails. */
  teleportDistance: number;
  /** Thruster emissive intensity range scaled by throttle input. */
  thrusterIntensity: { base: number; range: number };
}

export type RendererVisualPerformanceTier = 'high' | 'medium' | 'low';

export interface RendererVisualConfig {
  // Master switch: when false, per-ship visual smoothing is disabled.
  enableShipVisualSmoothing: boolean;
  // Global toggle to allow/deny bobbing offsets.
  enableShipBob: boolean;
  // Global toggle to allow/deny visual banking.
  enableShipBanking: boolean;
  // Performance tier influences which visual effects are allowed.
  performanceTier: RendererVisualPerformanceTier;
}

export const RENDERER_MOTION_DEFAULTS: RendererMotionConfig = {
  positionK: 12.0,
  rotationK: 30.0,
  bankK: 18.0,
  maxBankDeg: 32,
  bankFactor: 18,
  teleportDistance: 30,
  thrusterIntensity: { base: 0.4, range: 1.2 },
};

/** Global renderer visual toggles. */
export const RENDERER_VISUAL_CONFIG: RendererVisualConfig = {
  enableShipVisualSmoothing: true,
  enableShipBob: true,
  enableShipBanking: true,
  performanceTier: 'high',
};

export function resolveRendererMotionConfig(motion?: MotionStats): RendererMotionConfig {
  const visual = motion?.visual;
  return {
    positionK: visual?.position?.k ?? RENDERER_MOTION_DEFAULTS.positionK,
    rotationK: visual?.rotation?.k ?? RENDERER_MOTION_DEFAULTS.rotationK,
    bankK: visual?.bank?.k ?? RENDERER_MOTION_DEFAULTS.bankK,
    maxBankDeg: visual?.bank?.maxDeg ?? motion?.maxBankDeg ?? RENDERER_MOTION_DEFAULTS.maxBankDeg,
    bankFactor: motion?.visualBankFactor ?? RENDERER_MOTION_DEFAULTS.bankFactor,
    teleportDistance: visual?.teleportDistance ?? RENDERER_MOTION_DEFAULTS.teleportDistance,
    thrusterIntensity: RENDERER_MOTION_DEFAULTS.thrusterIntensity,
  };
}
