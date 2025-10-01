import type { MotionStats } from '../types/index.js';
import { validateMotionStats } from '../game/validation.js';

/**
 * Create default motion stats for testing and fallback scenarios.
 */
export function createDefaultMotionStats(): MotionStats {
  const stats: MotionStats = {
    mass: 1.0,
    maxSpeed: 10,
    maxReverseSpeed: 3,
    linearAcceleration: 20,
    linearDamping: 2.0,
    maxTurnRate: Math.PI,
    angularAcceleration: Math.PI * 2,
    angularDamping: 5.0,
    maxLateralAcceleration: 8,
    visualBankFactor: 16,
    maxBankDeg: 28,
    smoothing: {
      positionLerp: 0.18,
      rotationSlerp: 0.22,
      bankLerp: 0.18,
      teleportDistance: 40,
    },
  };
  validateMotionStats(stats);
  return stats;
}
