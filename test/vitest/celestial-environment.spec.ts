import { describe, expect, it } from 'vitest';
import { PLANET_TEXTURE_PATHS } from '../../src/assets/planets.js';
import { CELESTIAL_ENVIRONMENT, PLANET_GEOMETRY_SEGMENTS } from '../../src/config/environment.js';

describe('celestial environment config', () => {
  it('references known planet texture keys', () => {
    const knownKeys = new Set(Object.keys(PLANET_TEXTURE_PATHS));
    for (const planet of CELESTIAL_ENVIRONMENT.planets) {
      expect(knownKeys.has(planet.textureKey)).toBe(true);
      expect(typeof planet.radius).toBe('number');
      expect(planet.radius).toBeGreaterThan(0);
    }
  });

  it('ensures rotation axes are normalised when present', () => {
    for (const planet of CELESTIAL_ENVIRONMENT.planets) {
      if (!planet.rotation) {
        continue;
      }
      const { axis } = planet.rotation;
      const lengthSq = axis.x * axis.x + axis.y * axis.y + axis.z * axis.z;
      expect(Math.abs(Math.sqrt(lengthSq) - 1)).toBeLessThan(1e-3);
      expect(Number.isFinite(planet.rotation.speed)).toBe(true);
    }
  });

  it('provides valid star light direction and distance', () => {
    const { direction, distance, intensity } = CELESTIAL_ENVIRONMENT.starLight;
    const lengthSq =
      direction.x * direction.x + direction.y * direction.y + direction.z * direction.z;
    expect(Math.abs(Math.sqrt(lengthSq) - 1)).toBeLessThan(1e-3);
    expect(distance).toBeGreaterThan(0);
    expect(intensity).toBeGreaterThan(0);
  });

  it('defines reasonable geometry segments', () => {
    expect(PLANET_GEOMETRY_SEGMENTS.width).toBeGreaterThanOrEqual(48);
    expect(PLANET_GEOMETRY_SEGMENTS.height).toBeGreaterThanOrEqual(24);
    expect(PLANET_GEOMETRY_SEGMENTS.width % 2).toBe(0);
  });
});
