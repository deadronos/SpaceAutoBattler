import { describe, it, expect, beforeEach } from 'vitest';
import { Color } from 'three';
import { updateThrusterIntensity, type ThrusterMaterial } from '../../src/hooks/useShipThrusters.js';

describe('Ship Thrusters', () => {
  let mockThrusters: ThrusterMaterial[];
  let thrusterColorRef: Color;

  beforeEach(() => {
    thrusterColorRef = new Color();

    // Create mock thruster materials
    mockThrusters = [
      {
        material: {
          emissiveIntensity: 0.5,
          emissive: {
            copy: function(color: Color) {
              this.r = color.r;
              this.g = color.g;
              this.b = color.b;
            },
            r: 0,
            g: 0,
            b: 0,
          },
        },
        baseEmissive: new Color(0.2, 0.4, 1.0),
        baseIntensity: 0.8,
      },
      {
        material: {
          emissiveIntensity: 1.0,
          emissive: {
            copy: function(color: Color) {
              this.r = color.r;
              this.g = color.g;
              this.b = color.b;
            },
            r: 0,
            g: 0,
            b: 0,
          },
        },
        baseEmissive: new Color(1.0, 0.5, 0.2),
        baseIntensity: 1.0,
      },
    ];
  });

  describe('updateThrusterIntensity', () => {
    it('updates emissive intensity based on throttle', () => {
      const throttle = 0.5;
      const baseIntensity = 0.6;
      const range = 0.4;

      updateThrusterIntensity(mockThrusters, throttle, baseIntensity, range, thrusterColorRef);

      // First thruster: baseIntensity (0.8) + range (0.4) * throttle (0.5) = 1.0
      expect(mockThrusters[0].material.emissiveIntensity).toBeCloseTo(1.0);
      
      // Second thruster: baseIntensity (1.0) + range (0.4) * throttle (0.5) = 1.2
      expect(mockThrusters[1].material.emissiveIntensity).toBeCloseTo(1.2);
    });

    it('updates emissive color based on throttle', () => {
      const throttle = 0.6;
      const baseIntensity = 0.5;
      const range = 0.3;

      updateThrusterIntensity(mockThrusters, throttle, baseIntensity, range, thrusterColorRef);

      // Color should be base color * (1 + throttle * 0.6)
      const expectedMultiplier = 1 + 0.6 * 0.6; // 1.36

      // Check first thruster
      const firstExpectedR = 0.2 * expectedMultiplier;
      const firstExpectedG = 0.4 * expectedMultiplier;
      const firstExpectedB = 1.0 * expectedMultiplier;
      
      expect(mockThrusters[0].material.emissive.r).toBeCloseTo(firstExpectedR, 3);
      expect(mockThrusters[0].material.emissive.g).toBeCloseTo(firstExpectedG, 3);
      expect(mockThrusters[0].material.emissive.b).toBeCloseTo(firstExpectedB, 3);
    });

    it('handles zero throttle correctly', () => {
      const throttle = 0;
      const baseIntensity = 0.5;
      const range = 0.3;

      updateThrusterIntensity(mockThrusters, throttle, baseIntensity, range, thrusterColorRef);

      // Intensity should be just the base intensity for each thruster
      expect(mockThrusters[0].material.emissiveIntensity).toBeCloseTo(0.8); // Uses thruster's baseIntensity
      expect(mockThrusters[1].material.emissiveIntensity).toBeCloseTo(1.0); // Uses thruster's baseIntensity

      // Color should be base color * 1.0 (no throttle multiplier)
      expect(mockThrusters[0].material.emissive.r).toBeCloseTo(0.2);
      expect(mockThrusters[0].material.emissive.g).toBeCloseTo(0.4);
      expect(mockThrusters[0].material.emissive.b).toBeCloseTo(1.0);
    });

    it('handles maximum throttle correctly', () => {
      const throttle = 1.0;
      const baseIntensity = 0.4;
      const range = 0.6;

      updateThrusterIntensity(mockThrusters, throttle, baseIntensity, range, thrusterColorRef);

      // Intensity should be base + full range
      expect(mockThrusters[0].material.emissiveIntensity).toBeCloseTo(1.4); // 0.8 + 0.6
      expect(mockThrusters[1].material.emissiveIntensity).toBeCloseTo(1.6); // 1.0 + 0.6

      // Color should be base color * 1.6 (1 + 1.0 * 0.6)
      const expectedMultiplier = 1.6;
      expect(mockThrusters[0].material.emissive.r).toBeCloseTo(0.2 * expectedMultiplier);
      expect(mockThrusters[0].material.emissive.g).toBeCloseTo(0.4 * expectedMultiplier);
      expect(mockThrusters[0].material.emissive.b).toBeCloseTo(1.0 * expectedMultiplier);
    });

    it('falls back to global base intensity when thruster has no baseIntensity', () => {
      const thrusterWithoutBase: ThrusterMaterial = {
        material: {
          emissiveIntensity: 0.5,
          emissive: {
            copy: function(color: Color) {
              this.r = color.r;
              this.g = color.g;
              this.b = color.b;
            },
            r: 0,
            g: 0,
            b: 0,
          },
        },
        baseEmissive: new Color(1.0, 1.0, 1.0),
        // No baseIntensity property
      };

      const throttle = 0.5;
      const baseIntensity = 0.7;
      const range = 0.2;

      updateThrusterIntensity([thrusterWithoutBase], throttle, baseIntensity, range, thrusterColorRef);

      // Should use global baseIntensity: 0.7 + 0.2 * 0.5 = 0.8
      expect(thrusterWithoutBase.material.emissiveIntensity).toBeCloseTo(0.8);
    });

    it('skips thrusters with null material', () => {
      const thrusterWithNullMaterial: ThrusterMaterial = {
        material: null,
        baseEmissive: new Color(1, 1, 1),
        baseIntensity: 1.0,
      };

      const throttle = 0.5;
      const baseIntensity = 0.5;
      const range = 0.3;

      // Should not throw error
      expect(() => {
        updateThrusterIntensity([thrusterWithNullMaterial], throttle, baseIntensity, range, thrusterColorRef);
      }).not.toThrow();
    });

    it('skips materials without emissive property', () => {
      const thrusterWithoutEmissive: ThrusterMaterial = {
        material: {
          emissiveIntensity: 0.5,
          // No emissive property
        },
        baseEmissive: new Color(1, 1, 1),
        baseIntensity: 1.0,
      };

      const throttle = 0.5;
      const baseIntensity = 0.5;
      const range = 0.3;

      // Should not throw error and should still update intensity
      expect(() => {
        updateThrusterIntensity([thrusterWithoutEmissive], throttle, baseIntensity, range, thrusterColorRef);
      }).not.toThrow();

      expect(thrusterWithoutEmissive.material.emissiveIntensity).toBeCloseTo(1.15); // 1.0 (thruster base) + 0.3 * 0.5
    });

    it('handles multiple thrusters with different properties', () => {
      const throttle = 0.75;
      const baseIntensity = 0.5;
      const range = 0.4;

      updateThrusterIntensity(mockThrusters, throttle, baseIntensity, range, thrusterColorRef);

      // Each thruster should be updated independently
      expect(mockThrusters[0].material.emissiveIntensity).toBeCloseTo(1.1); // 0.8 + 0.4 * 0.75
      expect(mockThrusters[1].material.emissiveIntensity).toBeCloseTo(1.3); // 1.0 + 0.4 * 0.75

      // Colors should also be updated for both
      const expectedMultiplier = 1 + 0.75 * 0.6; // 1.45
      expect(mockThrusters[0].material.emissive.r).toBeCloseTo(0.2 * expectedMultiplier);
      expect(mockThrusters[1].material.emissive.r).toBeCloseTo(1.0 * expectedMultiplier);
    });
  });
});