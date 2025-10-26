import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MathUtils, Quaternion, Vector3 } from 'three';
import {
  updateInterpolation,
  kToAlpha,
  type InterpolationState,
  type SmoothingConfig,
} from '../../src/hooks/useShipInterpolation.js';
import type { ShipEntity } from '../../src/types/index.js';
import { RENDERER_VISUAL_CONFIG } from '../../src/config/renderer.js';

interface Ref<T> {
  current: T;
}

function createTestEntity(): ShipEntity {
  return {
    id: 1,
    transform: {
      position: new Vector3(0, 0, 0),
      rotation: new Quaternion(),
      scale: 1,
    },
    ship: {
      motion: {
        mass: 1,
        maxSpeed: 40,
        maxReverseSpeed: 5,
        linearAcceleration: 30,
        linearDamping: 2,
        maxTurnRate: Math.PI * 1.5,
        angularAcceleration: Math.PI * 3,
        angularDamping: 5,
        turnKp: 4,
        turnKd: 1,
        angularSettlingRate: 0.01,
        angularSettleToleranceDeg: 3,
        maxLateralAcceleration: 10,
        visualBankFactor: 18,
        maxBankDeg: 32,
        visual: {
          enabled: true,
          position: { k: 12 },
          rotation: { k: 30 },
          bank: { k: 18, maxDeg: 32, useCriticallyDamped: true },
          bob: { enabled: true, baseAmp: 0.08, freq: 1.2, speedScale: 1, maxAmp: 0.22 },
          teleportDistance: 35,
        },
      },
      angularVelocity: new Vector3(0, 0, 0),
      velocity: new Vector3(0, 0, 0),
      lateralAcceleration: 0,
    },
  } as ShipEntity;
}

function createSmoothingConfig(): SmoothingConfig {
  return {
    positionK: 12,
    rotationK: 30,
    bankK: 18,
    teleportThresholdSq: 900,
    bankFactor: 18,
    maxBankDeg: 32,
    thrusterIntensity: { base: 0.4, range: 1.2 },
  };
}

function createInterpolationState(
  bankValueRef: Ref<number>,
  bankVelocityRef: Ref<number>,
  lastTickIndexRef: Ref<number>,
): InterpolationState {
  const state: Partial<InterpolationState> = {
    prevSimPosition: new Vector3(),
    prevSimRotation: new Quaternion(),
    currSimPosition: new Vector3(),
    currSimRotation: new Quaternion(),
    visualPosition: new Vector3(),
    visualRotation: new Quaternion(),
    targetVisualPosition: new Vector3(),
    visualLocalOffset: new Vector3(),
    visualOffset: new Vector3(),
    interpPosition: new Vector3(),
    interpRotation: new Quaternion(),
    inverseInterpRotation: new Quaternion(),
    bankQuaternion: new Quaternion(),
    forwardAxis: new Vector3(0, 0, 1),
    finalRotation: new Quaternion(),
  };

  Object.defineProperties(state, {
    bankValue: { get: () => bankValueRef.current },
    lastTickIndex: { get: () => lastTickIndexRef.current },
  });

  return state as InterpolationState;
}

function initialiseState(
  state: InterpolationState,
  entity: ShipEntity,
  bankValueRef: Ref<number>,
  bankVelocityRef: Ref<number>,
  lastTickIndexRef: Ref<number>,
): void {
  state.prevSimPosition.copy(entity.transform.position);
  state.currSimPosition.copy(entity.transform.position);
  state.visualPosition.copy(entity.transform.position);
  state.targetVisualPosition.copy(entity.transform.position);
  state.visualLocalOffset.set(0, 0, 0);
  state.visualOffset.set(0, 0, 0);
  state.interpPosition.copy(entity.transform.position);
  state.interpRotation.copy(entity.transform.rotation);
  state.inverseInterpRotation.copy(entity.transform.rotation).invert();
  state.visualRotation.copy(entity.transform.rotation);
  state.finalRotation.copy(entity.transform.rotation);
  bankValueRef.current = 0;
  bankVelocityRef.current = 0;
  lastTickIndexRef.current = 0;
}

describe('useShipInterpolation helpers', () => {
  let originalToggle: boolean;

  beforeEach(() => {
    originalToggle = RENDERER_VISUAL_CONFIG.enableShipVisualSmoothing;
    RENDERER_VISUAL_CONFIG.enableShipVisualSmoothing = true;
  });

  afterEach(() => {
    RENDERER_VISUAL_CONFIG.enableShipVisualSmoothing = originalToggle;
  });

  describe('kToAlpha', () => {
    it('returns zero for non-positive values', () => {
      expect(kToAlpha(0, 1 / 60)).toBe(0);
      expect(kToAlpha(12, 0)).toBe(0);
    });

    it('scales alpha relative to dt', () => {
      const fast = kToAlpha(12, 1 / 30);
      const slow = kToAlpha(12, 1 / 120);
      expect(fast).toBeGreaterThan(slow);
      expect(fast).toBeCloseTo(1 - Math.exp(-12 / 30), 5);
    });
  });

  describe('updateInterpolation', () => {
    it('converges consistently across variable dt sequences', () => {
      const smoothing = createSmoothingConfig();

      function runSequence(dts: number[]): number {
        const entity = createTestEntity();
        entity.transform.position.set(10, 0, 0);
        entity.ship.motion.visual!.position = { k: 16 };
        entity.ship.motion.visual!.rotation = { k: 30 };
        entity.ship.angularVelocity.set(0, 0, 0);
        entity.ship.velocity.set(0, 0, 0);
        entity.ship.lateralAcceleration = 0;

        const bankValueRef: Ref<number> = { current: 0 };
        const bankVelocityRef: Ref<number> = { current: 0 };
        const lastTickIndexRef: Ref<number> = { current: 0 };
        const state = createInterpolationState(bankValueRef, bankVelocityRef, lastTickIndexRef);
        initialiseState(state, entity, bankValueRef, bankVelocityRef, lastTickIndexRef);

        let accumulatedTime = 0;
        for (const dt of dts) {
          accumulatedTime += dt;
          updateInterpolation(
            entity,
            state,
            smoothing,
            1,
            dt,
            accumulatedTime,
            0,
            bankValueRef,
            bankVelocityRef,
            lastTickIndexRef,
          );
        }

        return state.visualPosition.x;
      }

      const uniformDts = Array.from({ length: 60 }, () => 1 / 60);
      const variedBase = [1 / 30, 1 / 45, 1 / 50, 1 / 90, 1 / 70, 1 / 40];
      const total = variedBase.reduce((sum, dt) => sum + dt, 0);
      const variedDts = variedBase.map((dt) => dt / total);

      const uniformResult = runSequence(uniformDts);
      const variedResult = runSequence(variedDts);

      expect(uniformResult).toBeCloseTo(10, 0);
      expect(variedResult).toBeCloseTo(10, 1);
      expect(Math.abs(uniformResult - variedResult)).toBeLessThan(0.05);
    });

    it('keeps critically damped bank within target bounds across dt changes', () => {
      const smoothing = createSmoothingConfig();
      const entity = createTestEntity();
      entity.ship.motion.visual!.bank = { k: 20, maxDeg: 30, useCriticallyDamped: true };
      entity.ship.angularVelocity.set(0, 0.6, 0);
      entity.ship.lateralAcceleration = 0;

      const maxBankDeg = entity.ship.motion.visual!.bank!.maxDeg ?? 30;
      const targetBankRad = MathUtils.degToRad(
        Math.min(
          maxBankDeg,
          entity.ship.angularVelocity.y *
            (entity.ship.motion.visualBankFactor ?? smoothing.bankFactor),
        ),
      );

      const bankValueRef: Ref<number> = { current: 0 };
      const bankVelocityRef: Ref<number> = { current: 0 };
      const lastTickIndexRef: Ref<number> = { current: 0 };
      const state = createInterpolationState(bankValueRef, bankVelocityRef, lastTickIndexRef);
      initialiseState(state, entity, bankValueRef, bankVelocityRef, lastTickIndexRef);

      const dts = [1 / 120, 1 / 60, 1 / 45, 1 / 30, 1 / 20];
      let time = 0;
      for (const dt of dts) {
        time += dt;
        updateInterpolation(
          entity,
          state,
          smoothing,
          1,
          dt,
          time,
          0,
          bankValueRef,
          bankVelocityRef,
          lastTickIndexRef,
        );

        expect(Math.abs(bankValueRef.current)).toBeLessThanOrEqual(Math.abs(targetBankRad) + 1e-3);
      }

      expect(bankValueRef.current).toBeCloseTo(targetBankRad, 1);
    });

    it('bypasses smoothing when the global toggle is disabled', () => {
      const smoothing = createSmoothingConfig();
      const entity = createTestEntity();
      entity.ship.motion.visual!.enabled = true;

      const bankValueRef: Ref<number> = { current: 0 };
      const bankVelocityRef: Ref<number> = { current: 0 };
      const lastTickIndexRef: Ref<number> = { current: 0 };
      const state = createInterpolationState(bankValueRef, bankVelocityRef, lastTickIndexRef);
      initialiseState(state, entity, bankValueRef, bankVelocityRef, lastTickIndexRef);

      RENDERER_VISUAL_CONFIG.enableShipVisualSmoothing = false;

      updateInterpolation(
        entity,
        state,
        smoothing,
        1,
        1 / 60,
        1 / 60,
        0,
        bankValueRef,
        bankVelocityRef,
        lastTickIndexRef,
      );

      expect(state.visualPosition.equals(state.interpPosition)).toBe(true);
      expect(state.visualRotation.equals(state.interpRotation)).toBe(true);
      expect(state.visualOffset.length()).toBeLessThan(1e-6);
    });

    it('applies bob offsets scaled by speed and clamped to maximum amplitude', () => {
      const smoothing = createSmoothingConfig();
      const entity = createTestEntity();
      const bob = entity.ship.motion.visual!.bob!;
      bob.enabled = true;
      bob.baseAmp = 0.08;
      bob.maxAmp = 0.2;
      bob.freq = 1.0;
      bob.speedScale = 1.0;
      entity.ship.motion.visual!.position = { k: 60 };
      entity.ship.motion.visual!.rotation = { k: 60 };

      const bankValueRef: Ref<number> = { current: 0 };
      const bankVelocityRef: Ref<number> = { current: 0 };
      const lastTickIndexRef: Ref<number> = { current: 0 };
      const state = createInterpolationState(bankValueRef, bankVelocityRef, lastTickIndexRef);
      initialiseState(state, entity, bankValueRef, bankVelocityRef, lastTickIndexRef);

      // Low speed should fade the bob nearly to zero
      entity.ship.velocity.set(0.1, 0, 0);
      updateInterpolation(
        entity,
        state,
        smoothing,
        1,
        1 / 60,
        1 / 60,
        0,
        bankValueRef,
        bankVelocityRef,
        lastTickIndexRef,
      );
      expect(Math.abs(state.visualOffset.y)).toBeLessThan(0.01);

      // High speed should push towards the configured max amplitude
      initialiseState(state, entity, bankValueRef, bankVelocityRef, lastTickIndexRef);
      entity.ship.velocity.set(entity.ship.motion.maxSpeed, 0, 0);
      const phaseTime = 0.25 / bob.freq;
      updateInterpolation(
        entity,
        state,
        smoothing,
        1,
        phaseTime,
        phaseTime,
        0,
        bankValueRef,
        bankVelocityRef,
        lastTickIndexRef,
      );

      expect(Math.abs(state.visualOffset.y)).toBeGreaterThan(0.05);
      expect(Math.abs(state.visualOffset.y)).toBeLessThanOrEqual(bob.maxAmp! + 1e-3);
    });
  });
});
