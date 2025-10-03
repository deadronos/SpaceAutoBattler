import { describe, it, expect, beforeEach } from 'vitest';
import { Quaternion, Vector3 } from 'three';
import { updateInterpolation, type InterpolationState, type SmoothingConfig } from '../../src/hooks/useShipInterpolation.js';
import type { ShipEntity } from '../../src/types/index.js';

describe('Ship Interpolation', () => {
  let mockEntity: ShipEntity;
  let interpolationState: InterpolationState;
  let smoothingConfig: SmoothingConfig;
  let bankValueRef: { current: number };
  let lastTickIndexRef: { current: number };

  beforeEach(() => {
    mockEntity = {
      id: 1,
      transform: {
        position: new Vector3(10, 0, 5),
        rotation: new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 4),
        scale: 1,
      },
      ship: {
        motion: {
          maxLateralAcceleration: 100,
          visualBankFactor: 1.0,
          maxBankDeg: 30,
        },
        angularVelocity: new Vector3(0, 0.5, 0),
        lateralAcceleration: 50,
      },
    } as ShipEntity;

    interpolationState = {
      prevSimPosition: new Vector3(0, 0, 0),
      prevSimRotation: new Quaternion(),
      currSimPosition: new Vector3(0, 0, 0),
      currSimRotation: new Quaternion(),
      visualPosition: new Vector3(0, 0, 0),
      visualRotation: new Quaternion(),
      interpPosition: new Vector3(0, 0, 0),
      interpRotation: new Quaternion(),
      bankQuaternion: new Quaternion(),
      forwardAxis: new Vector3(0, 0, 1),
      finalRotation: new Quaternion(),
      bankValue: 0,
      lastTickIndex: 0,
    };

    smoothingConfig = {
      positionLerp: 0.1,
      rotationSlerp: 0.1,
      bankLerp: 0.05,
      teleportThresholdSq: 100,
      bankFactor: 1.0,
      maxBankDeg: 30,
      thrusterIntensity: { base: 0.5, range: 0.3 },
    };

    bankValueRef = { current: 0 };
    lastTickIndexRef = { current: 0 };
  });

  describe('updateInterpolation', () => {
    it('updates simulation positions when tick index changes', () => {
      const newTickIndex = 1;
      
      updateInterpolation(
        mockEntity,
        interpolationState,
        smoothingConfig,
        0.5,
        newTickIndex,
        bankValueRef,
        lastTickIndexRef,
      );

      expect(lastTickIndexRef.current).toBe(1);
      expect(interpolationState.currSimPosition).toEqual(mockEntity.transform.position);
      expect(interpolationState.currSimRotation).toEqual(mockEntity.transform.rotation);
    });

    it('interpolates position correctly with alpha', () => {
      // Set up initial state
      interpolationState.prevSimPosition.set(0, 0, 0);
      interpolationState.currSimPosition.set(10, 0, 0);
      // Update entity position to match currSimPosition
      mockEntity.transform.position.set(10, 0, 0);
      
      updateInterpolation(
        mockEntity,
        interpolationState,
        smoothingConfig,
        0.5, // 50% interpolation
        lastTickIndexRef.current, // Same tick
        bankValueRef,
        lastTickIndexRef,
      );

      // Should interpolate to midpoint
      expect(interpolationState.interpPosition.x).toBeCloseTo(5);
      expect(interpolationState.interpPosition.y).toBeCloseTo(0);
      expect(interpolationState.interpPosition.z).toBeCloseTo(0);
    });

    it('handles teleport threshold correctly', () => {
      const farPosition = new Vector3(1000, 0, 0);
      mockEntity.transform.position = farPosition;
      
      // Set previous position close to origin
      interpolationState.prevSimPosition.set(0, 0, 0);
      interpolationState.visualPosition.set(0, 0, 0);
      
      updateInterpolation(
        mockEntity,
        interpolationState,
        smoothingConfig,
        0.5,
        1, // New tick index
        bankValueRef,
        lastTickIndexRef,
      );

      // Should teleport instead of interpolate
      expect(interpolationState.visualPosition).toEqual(farPosition);
    });

    it('calculates banking based on angular velocity', () => {
      mockEntity.ship.angularVelocity.y = 1.0; // 1 rad/s yaw rate
      
      updateInterpolation(
        mockEntity,
        interpolationState,
        smoothingConfig,
        0.5,
        lastTickIndexRef.current,
        bankValueRef,
        lastTickIndexRef,
      );

      // Bank angle should be affected by yaw rate
      expect(Math.abs(bankValueRef.current)).toBeGreaterThan(0);
      expect(Math.abs(bankValueRef.current)).toBeLessThanOrEqual(Math.PI / 6); // 30 degrees max
    });

    it('applies lateral acceleration to banking', () => {
      mockEntity.ship.angularVelocity.y = 0; // No yaw
      mockEntity.ship.lateralAcceleration = 100; // Max lateral acceleration
      
      updateInterpolation(
        mockEntity,
        interpolationState,
        smoothingConfig,
        0.5,
        lastTickIndexRef.current,
        bankValueRef,
        lastTickIndexRef,
      );

      // Should have banking from lateral acceleration
      expect(Math.abs(bankValueRef.current)).toBeGreaterThan(0);
    });

    it('respects maximum bank angle limits', () => {
      mockEntity.ship.angularVelocity.y = 10.0; // Very high yaw rate
      mockEntity.ship.lateralAcceleration = 1000; // Very high lateral acceleration
      
      updateInterpolation(
        mockEntity,
        interpolationState,
        smoothingConfig,
        0.5,
        lastTickIndexRef.current,
        bankValueRef,
        lastTickIndexRef,
      );

      const maxBankRad = Math.PI / 6; // 30 degrees
      expect(Math.abs(bankValueRef.current)).toBeLessThanOrEqual(maxBankRad + 0.01); // Small tolerance
    });

    it('applies banking smoothing', () => {
      const initialBank = bankValueRef.current;
      mockEntity.ship.angularVelocity.y = 1.0;
      
      updateInterpolation(
        mockEntity,
        interpolationState,
        smoothingConfig,
        0.5,
        lastTickIndexRef.current,
        bankValueRef,
        lastTickIndexRef,
      );

      const firstUpdate = bankValueRef.current;
      
      updateInterpolation(
        mockEntity,
        interpolationState,
        smoothingConfig,
        0.5,
        lastTickIndexRef.current,
        bankValueRef,
        lastTickIndexRef,
      );

      const secondUpdate = bankValueRef.current;
      
      // Bank value should smooth towards target, not jump immediately
      expect(Math.abs(secondUpdate - firstUpdate)).toBeLessThan(Math.abs(firstUpdate - initialBank));
    });

    it('applies banking rotation to final rotation', () => {
      bankValueRef.current = Math.PI / 12; // 15 degrees
      interpolationState.visualRotation.identity();
      
      updateInterpolation(
        mockEntity,
        interpolationState,
        smoothingConfig,
        0.5,
        lastTickIndexRef.current,
        bankValueRef,
        lastTickIndexRef,
      );

      // Final rotation should be different from visual rotation due to banking
      expect(interpolationState.finalRotation.equals(interpolationState.visualRotation)).toBe(false);
    });

    it('skips banking when bank value is very small', () => {
      bankValueRef.current = 0.00001; // Very small bank value
      interpolationState.visualRotation.identity();
      interpolationState.finalRotation.identity();
      
      // Zero out entity motion to prevent banking calculation
      mockEntity.ship.angularVelocity.set(0, 0, 0);
      mockEntity.ship.lateralAcceleration = 0;
      
      updateInterpolation(
        mockEntity,
        interpolationState,
        smoothingConfig,
        0.5,
        lastTickIndexRef.current,
        bankValueRef,
        lastTickIndexRef,
      );

      // Final rotation should be very close to visual rotation when bank is negligible
      const angleDiff = interpolationState.finalRotation.angleTo(interpolationState.visualRotation);
      expect(angleDiff).toBeLessThan(0.001); // Very small angle difference
    });
  });
});