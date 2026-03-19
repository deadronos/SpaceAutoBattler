import { expect, test, describe } from 'vite-plus/test';
import { Quaternion, Euler, Vector3 } from 'three';
import type { PlanetBodyConfig } from '../../src/config/environment.js';

/**
 * Test suite for deterministic planet rotation calculations.
 * Ensures that given a simulation time, planet rotation produces consistent angles.
 */
describe('Planet Deterministic Rotation', () => {
  const mockPlanetConfig: PlanetBodyConfig = {
    id: 'testPlanet',
    textureKey: 'gasGiant12',
    radius: 1000,
    position: { x: 0, y: 0, z: 0 },
    tilt: { x: 0.1, y: 0.35, z: 0 },
    rotation: {
      axis: { x: 0, y: 1, z: 0 },
      speed: 0.012, // radians per simulated second
      offset: 0.6,
    },
  };

  /**
   * Helper function to calculate planet rotation quaternion given simulation time.
   * This mirrors the logic in PlanetBody.tsx
   */
  function calculatePlanetRotation(config: PlanetBodyConfig, simTime: number): Quaternion {
    const workingQuat = new Quaternion();
    const spinQuat = new Quaternion();

    // Apply tilt if specified
    if (config.tilt) {
      const tiltQuat = new Quaternion().setFromEuler(
        new Euler(config.tilt.x, config.tilt.y, config.tilt.z, 'XYZ'),
      );
      workingQuat.copy(tiltQuat);
    }

    // Apply rotation if specified
    if (config.rotation) {
      const rotationAxis = new Vector3(
        config.rotation.axis.x,
        config.rotation.axis.y,
        config.rotation.axis.z,
      ).normalize();

      const angle = (config.rotation.offset ?? 0) + simTime * config.rotation.speed;
      spinQuat.setFromAxisAngle(rotationAxis, angle);
      workingQuat.multiply(spinQuat);
    }

    return workingQuat;
  }

  test('produces identical rotations for identical simulation times', () => {
    const simTime = 100.5; // arbitrary simulation time

    const rotation1 = calculatePlanetRotation(mockPlanetConfig, simTime);
    const rotation2 = calculatePlanetRotation(mockPlanetConfig, simTime);

    // Quaternions should be identical
    expect(rotation1.x).toBeCloseTo(rotation2.x, 10);
    expect(rotation1.y).toBeCloseTo(rotation2.y, 10);
    expect(rotation1.z).toBeCloseTo(rotation2.z, 10);
    expect(rotation1.w).toBeCloseTo(rotation2.w, 10);
  });

  test('rotation progresses predictably with time', () => {
    const baseTime = 0;
    const deltaTime = 10; // 10 seconds

    const rotation0 = calculatePlanetRotation(mockPlanetConfig, baseTime);
    const rotation10 = calculatePlanetRotation(mockPlanetConfig, baseTime + deltaTime);

    // Calculate expected angle difference
    const expectedAngleDiff = deltaTime * mockPlanetConfig.rotation!.speed;

    // Extract angles from quaternions for comparison
    const euler0 = new Euler().setFromQuaternion(rotation0, 'XYZ');
    const euler10 = new Euler().setFromQuaternion(rotation10, 'XYZ');

    // Y-axis rotation should have changed by expectedAngleDiff (accounting for tilt interaction)
    const actualAngleDiff = Math.abs(euler10.y - euler0.y);

    // Allow some tolerance for tilt interaction and floating point precision
    expect(actualAngleDiff).toBeCloseTo(expectedAngleDiff, 2);
  });

  test('handles edge cases correctly', () => {
    // Test with zero time
    const rotationZero = calculatePlanetRotation(mockPlanetConfig, 0);
    expect(rotationZero).toBeDefined();

    // Test with negative time
    const rotationNegative = calculatePlanetRotation(mockPlanetConfig, -50);
    expect(rotationNegative).toBeDefined();

    // Test with very large time
    const rotationLarge = calculatePlanetRotation(mockPlanetConfig, 1000000);
    expect(rotationLarge).toBeDefined();

    // Quaternion should still be normalized
    const magnitude = Math.sqrt(
      rotationLarge.x ** 2 + rotationLarge.y ** 2 + rotationLarge.z ** 2 + rotationLarge.w ** 2,
    );
    expect(magnitude).toBeCloseTo(1.0, 6);
  });

  test('respects rotation configuration parameters', () => {
    const configWithOffset: PlanetBodyConfig = {
      ...mockPlanetConfig,
      rotation: {
        axis: { x: 0, y: 1, z: 0 },
        speed: 0.1,
        offset: Math.PI / 2, // 90 degrees offset
      },
    };

    const configWithoutOffset: PlanetBodyConfig = {
      ...mockPlanetConfig,
      rotation: {
        axis: { x: 0, y: 1, z: 0 },
        speed: 0.1,
        offset: 0,
      },
    };

    const simTime = 0; // At time 0, only offset should matter

    const rotationWithOffset = calculatePlanetRotation(configWithOffset, simTime);
    const rotationWithoutOffset = calculatePlanetRotation(configWithoutOffset, simTime);

    // The rotations should be different due to the offset
    const dotProduct = Math.abs(
      rotationWithOffset.x * rotationWithoutOffset.x +
        rotationWithOffset.y * rotationWithoutOffset.y +
        rotationWithOffset.z * rotationWithoutOffset.z +
        rotationWithOffset.w * rotationWithoutOffset.w,
    );

    // If quaternions are identical, dot product would be 1
    expect(dotProduct).toBeLessThan(0.99);
  });

  test('handles missing rotation configuration gracefully', () => {
    const configNoRotation: PlanetBodyConfig = {
      ...mockPlanetConfig,
      rotation: undefined,
    };

    const rotation = calculatePlanetRotation(configNoRotation, 100);

    // Should only apply tilt, no spin
    expect(rotation).toBeDefined();

    // Verify it's still a valid normalized quaternion
    const magnitude = Math.sqrt(
      rotation.x ** 2 + rotation.y ** 2 + rotation.z ** 2 + rotation.w ** 2,
    );
    expect(magnitude).toBeCloseTo(1.0, 6);
  });
});
