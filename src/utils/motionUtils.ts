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
    turnKp: 4.5,
    turnKd: 0.75,
    angularSettlingRate: 0.1,
    angularSettleToleranceDeg: 4,
    maxLateralAcceleration: 8,
    visualBankFactor: 16,
    maxBankDeg: 28,
    visual: {
      enabled: true,
      position: { k: 12.0 },
      rotation: { k: 30.0 },
      bank: { k: 18.0, maxDeg: 28, useCriticallyDamped: true },
      teleportDistance: 40,
      bob: { enabled: false, baseAmp: 0.06, freq: 1.2, speedScale: 1.0, maxAmp: 0.2 },
    },
  };
  validateMotionStats(stats);
  return stats;
}
