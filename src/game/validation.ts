import type { MotionStats } from '../types/index.js';

function assertRange(name: string, value: number, opts: { min?: number; max?: number }): void {
  if (Number.isNaN(value) || !Number.isFinite(value)) {
    throw new Error(`${name} must be a finite number.`);
  }
  if (opts.min != null && value < opts.min) {
    throw new Error(`${name} must be ≥ ${opts.min}. Received ${value}.`);
  }
  if (opts.max != null && value > opts.max) {
    throw new Error(`${name} must be ≤ ${opts.max}. Received ${value}.`);
  }
}

export function validateMotionStats(stats: MotionStats): void {
  assertRange('motion.mass', stats.mass, { min: 0 });
  assertRange('motion.maxSpeed', stats.maxSpeed, { min: 0 });
  if (stats.maxReverseSpeed != null) {
    assertRange('motion.maxReverseSpeed', stats.maxReverseSpeed, { min: 0 });
  }
  assertRange('motion.linearAcceleration', stats.linearAcceleration, { min: 0 });
  assertRange('motion.linearDamping', stats.linearDamping, { min: 0 });
  assertRange('motion.maxTurnRate', stats.maxTurnRate, { min: 0 });
  assertRange('motion.angularAcceleration', stats.angularAcceleration, { min: 0 });
  assertRange('motion.angularDamping', stats.angularDamping, { min: 0 });
  if (stats.maxLateralAcceleration != null) {
    assertRange('motion.maxLateralAcceleration', stats.maxLateralAcceleration, { min: 0 });
  }
  if (stats.turnKp != null) {
    assertRange('motion.turnKp', stats.turnKp, { min: 0 });
  }
  if (stats.turnKd != null) {
    assertRange('motion.turnKd', stats.turnKd, { min: 0 });
  }
  if (stats.angularSettlingRate != null) {
    assertRange('motion.angularSettlingRate', stats.angularSettlingRate, { min: 0 });
  }
  if (stats.angularSettleToleranceDeg != null) {
    assertRange('motion.angularSettleToleranceDeg', stats.angularSettleToleranceDeg, { min: 0, max: 45 });
  }
  if (stats.maxBankDeg != null) {
    assertRange('motion.maxBankDeg', stats.maxBankDeg, { min: 0, max: 90 });
  }
  if (stats.visualBankFactor != null) {
    assertRange('motion.visualBankFactor', stats.visualBankFactor, { min: 0 });
  }
  if (stats.smoothing?.positionLerp != null) {
    assertRange('motion.smoothing.positionLerp', stats.smoothing.positionLerp, { min: 0, max: 1 });
  }
  if (stats.smoothing?.rotationSlerp != null) {
    assertRange('motion.smoothing.rotationSlerp', stats.smoothing.rotationSlerp, { min: 0, max: 1 });
  }
  if (stats.smoothing?.bankLerp != null) {
    assertRange('motion.smoothing.bankLerp', stats.smoothing.bankLerp, { min: 0, max: 1 });
  }
  if (stats.smoothing?.teleportDistance != null) {
    assertRange('motion.smoothing.teleportDistance', stats.smoothing.teleportDistance, { min: 0 });
  }

  // New visual config validations (time-constant semantics)
  if (stats.visual?.position?.k != null) {
    assertRange('motion.visual.position.k', stats.visual.position.k, { min: 0 });
  }
  if (stats.visual?.rotation?.k != null) {
    assertRange('motion.visual.rotation.k', stats.visual.rotation.k, { min: 0 });
  }
  if (stats.visual?.bank?.k != null) {
    assertRange('motion.visual.bank.k', stats.visual.bank.k, { min: 0 });
  }
  if (stats.visual?.bank?.maxDeg != null) {
    assertRange('motion.visual.bank.maxDeg', stats.visual.bank.maxDeg, { min: 0, max: 90 });
  }
  if (stats.visual?.teleportDistance != null) {
    assertRange('motion.visual.teleportDistance', stats.visual.teleportDistance, { min: 0 });
  }
  if (stats.visual?.bob?.baseAmp != null) {
    assertRange('motion.visual.bob.baseAmp', stats.visual.bob.baseAmp, { min: 0, max: 10 });
  }
  if (stats.visual?.bob?.freq != null) {
    assertRange('motion.visual.bob.freq', stats.visual.bob.freq, { min: 0, max: 10 });
  }
  if (stats.visual?.bob?.speedScale != null) {
    assertRange('motion.visual.bob.speedScale', stats.visual.bob.speedScale, { min: 0, max: 10 });
  }
  if (stats.visual?.bob?.maxAmp != null) {
    assertRange('motion.visual.bob.maxAmp', stats.visual.bob.maxAmp, { min: 0, max: 10 });
  }
}
