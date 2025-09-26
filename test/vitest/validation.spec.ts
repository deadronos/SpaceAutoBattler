import { describe, expect, it } from 'vitest';
import { validateMotionStats } from '../../src/game/validation.js';
import type { MotionStats } from '../../src/types/index.js';

describe('validateMotionStats', () => {
  const validStats: MotionStats = {
    mass: 10,
    maxSpeed: 100,
    maxReverseSpeed: 50,
    linearAcceleration: 20,
    linearDamping: 0.5,
    maxTurnRate: Math.PI,
    angularAcceleration: 1.5,
    angularDamping: 0.8,
    maxLateralAcceleration: 15,
    maxBankDeg: 45,
    visualBankFactor: 1.2,
    smoothing: {
      positionLerp: 0.3,
      rotationSlerp: 0.4,
      bankLerp: 0.5,
      teleportDistance: 100,
    },
  };

  it('accepts valid motion stats', () => {
    expect(() => validateMotionStats(validStats)).not.toThrow();
  });

  it('throws for NaN mass', () => {
    const stats = { ...validStats, mass: NaN };
    expect(() => validateMotionStats(stats)).toThrow('motion.mass must be a finite number');
  });

  it('throws for infinite maxSpeed', () => {
    const stats = { ...validStats, maxSpeed: Infinity };
    expect(() => validateMotionStats(stats)).toThrow('motion.maxSpeed must be a finite number');
  });

  it('throws for negative mass', () => {
    const stats = { ...validStats, mass: -5 };
    expect(() => validateMotionStats(stats)).toThrow('motion.mass must be ≥ 0. Received -5');
  });

  it('throws for negative maxSpeed', () => {
    const stats = { ...validStats, maxSpeed: -10 };
    expect(() => validateMotionStats(stats)).toThrow('motion.maxSpeed must be ≥ 0. Received -10');
  });

  it('throws for negative maxReverseSpeed', () => {
    const stats = { ...validStats, maxReverseSpeed: -20 };
    expect(() => validateMotionStats(stats)).toThrow('motion.maxReverseSpeed must be ≥ 0. Received -20');
  });

  it('accepts undefined maxReverseSpeed', () => {
    const stats = { ...validStats, maxReverseSpeed: undefined };
    expect(() => validateMotionStats(stats)).not.toThrow();
  });

  it('throws for negative linearAcceleration', () => {
    const stats = { ...validStats, linearAcceleration: -1 };
    expect(() => validateMotionStats(stats)).toThrow('motion.linearAcceleration must be ≥ 0. Received -1');
  });

  it('throws for negative linearDamping', () => {
    const stats = { ...validStats, linearDamping: -0.5 };
    expect(() => validateMotionStats(stats)).toThrow('motion.linearDamping must be ≥ 0. Received -0.5');
  });

  it('throws for negative maxTurnRate', () => {
    const stats = { ...validStats, maxTurnRate: -1 };
    expect(() => validateMotionStats(stats)).toThrow('motion.maxTurnRate must be ≥ 0. Received -1');
  });

  it('throws for negative angularAcceleration', () => {
    const stats = { ...validStats, angularAcceleration: -2 };
    expect(() => validateMotionStats(stats)).toThrow('motion.angularAcceleration must be ≥ 0. Received -2');
  });

  it('throws for negative angularDamping', () => {
    const stats = { ...validStats, angularDamping: -0.1 };
    expect(() => validateMotionStats(stats)).toThrow('motion.angularDamping must be ≥ 0. Received -0.1');
  });

  it('throws for negative maxLateralAcceleration', () => {
    const stats = { ...validStats, maxLateralAcceleration: -5 };
    expect(() => validateMotionStats(stats)).toThrow('motion.maxLateralAcceleration must be ≥ 0. Received -5');
  });

  it('accepts undefined maxLateralAcceleration', () => {
    const stats = { ...validStats, maxLateralAcceleration: undefined };
    expect(() => validateMotionStats(stats)).not.toThrow();
  });

  it('throws for negative maxBankDeg', () => {
    const stats = { ...validStats, maxBankDeg: -10 };
    expect(() => validateMotionStats(stats)).toThrow('motion.maxBankDeg must be ≥ 0. Received -10');
  });

  it('throws for maxBankDeg over 90', () => {
    const stats = { ...validStats, maxBankDeg: 95 };
    expect(() => validateMotionStats(stats)).toThrow('motion.maxBankDeg must be ≤ 90. Received 95');
  });

  it('accepts undefined maxBankDeg', () => {
    const stats = { ...validStats, maxBankDeg: undefined };
    expect(() => validateMotionStats(stats)).not.toThrow();
  });

  it('throws for negative visualBankFactor', () => {
    const stats = { ...validStats, visualBankFactor: -1 };
    expect(() => validateMotionStats(stats)).toThrow('motion.visualBankFactor must be ≥ 0. Received -1');
  });

  it('accepts undefined visualBankFactor', () => {
    const stats = { ...validStats, visualBankFactor: undefined };
    expect(() => validateMotionStats(stats)).not.toThrow();
  });

  it('throws for positionLerp below 0', () => {
    const stats = { ...validStats, smoothing: { ...validStats.smoothing!, positionLerp: -0.1 } };
    expect(() => validateMotionStats(stats)).toThrow('motion.smoothing.positionLerp must be ≥ 0. Received -0.1');
  });

  it('throws for positionLerp above 1', () => {
    const stats = { ...validStats, smoothing: { ...validStats.smoothing!, positionLerp: 1.5 } };
    expect(() => validateMotionStats(stats)).toThrow('motion.smoothing.positionLerp must be ≤ 1. Received 1.5');
  });

  it('accepts undefined positionLerp', () => {
    const stats = { ...validStats, smoothing: { ...validStats.smoothing!, positionLerp: undefined } };
    expect(() => validateMotionStats(stats)).not.toThrow();
  });

  it('throws for rotationSlerp below 0', () => {
    const stats = { ...validStats, smoothing: { ...validStats.smoothing!, rotationSlerp: -0.2 } };
    expect(() => validateMotionStats(stats)).toThrow('motion.smoothing.rotationSlerp must be ≥ 0. Received -0.2');
  });

  it('throws for rotationSlerp above 1', () => {
    const stats = { ...validStats, smoothing: { ...validStats.smoothing!, rotationSlerp: 2.0 } };
    expect(() => validateMotionStats(stats)).toThrow('motion.smoothing.rotationSlerp must be ≤ 1. Received 2');
  });

  it('accepts undefined rotationSlerp', () => {
    const stats = { ...validStats, smoothing: { ...validStats.smoothing!, rotationSlerp: undefined } };
    expect(() => validateMotionStats(stats)).not.toThrow();
  });

  it('throws for bankLerp below 0', () => {
    const stats = { ...validStats, smoothing: { ...validStats.smoothing!, bankLerp: -0.3 } };
    expect(() => validateMotionStats(stats)).toThrow('motion.smoothing.bankLerp must be ≥ 0. Received -0.3');
  });

  it('throws for bankLerp above 1', () => {
    const stats = { ...validStats, smoothing: { ...validStats.smoothing!, bankLerp: 1.1 } };
    expect(() => validateMotionStats(stats)).toThrow('motion.smoothing.bankLerp must be ≤ 1. Received 1.1');
  });

  it('accepts undefined bankLerp', () => {
    const stats = { ...validStats, smoothing: { ...validStats.smoothing!, bankLerp: undefined } };
    expect(() => validateMotionStats(stats)).not.toThrow();
  });

  it('throws for negative teleportDistance', () => {
    const stats = { ...validStats, smoothing: { ...validStats.smoothing!, teleportDistance: -50 } };
    expect(() => validateMotionStats(stats)).toThrow('motion.smoothing.teleportDistance must be ≥ 0. Received -50');
  });

  it('accepts undefined teleportDistance', () => {
    const stats = { ...validStats, smoothing: { ...validStats.smoothing!, teleportDistance: undefined } };
    expect(() => validateMotionStats(stats)).not.toThrow();
  });

  it('accepts undefined smoothing object', () => {
    const stats = { ...validStats, smoothing: undefined };
    expect(() => validateMotionStats(stats)).not.toThrow();
  });

  it('validates all edge cases at once', () => {
    const edgeStats: MotionStats = {
      mass: 0,
      maxSpeed: 0,
      maxReverseSpeed: 0,
      linearAcceleration: 0,
      linearDamping: 0,
      maxTurnRate: 0,
      angularAcceleration: 0,
      angularDamping: 0,
      maxLateralAcceleration: 0,
      maxBankDeg: 0,
      visualBankFactor: 0,
      smoothing: {
        positionLerp: 0,
        rotationSlerp: 0,
        bankLerp: 0,
        teleportDistance: 0,
      },
    };
    expect(() => validateMotionStats(edgeStats)).not.toThrow();
  });

  it('validates maximum allowed values', () => {
    const maxStats: MotionStats = {
      mass: Number.MAX_SAFE_INTEGER,
      maxSpeed: Number.MAX_SAFE_INTEGER,
      maxReverseSpeed: Number.MAX_SAFE_INTEGER,
      linearAcceleration: Number.MAX_SAFE_INTEGER,
      linearDamping: Number.MAX_SAFE_INTEGER,
      maxTurnRate: Number.MAX_SAFE_INTEGER,
      angularAcceleration: Number.MAX_SAFE_INTEGER,
      angularDamping: Number.MAX_SAFE_INTEGER,
      maxLateralAcceleration: Number.MAX_SAFE_INTEGER,
      maxBankDeg: 90,
      visualBankFactor: Number.MAX_SAFE_INTEGER,
      smoothing: {
        positionLerp: 1,
        rotationSlerp: 1,
        bankLerp: 1,
        teleportDistance: Number.MAX_SAFE_INTEGER,
      },
    };
    expect(() => validateMotionStats(maxStats)).not.toThrow();
  });
});