import { describe, expect, it } from 'vite-plus/test';
import fs from 'fs';
import path from 'path';
import {
  CELESTIAL_ENVIRONMENT,
  PLANET_ATMOSPHERE_SHELL_SCALE,
} from '../../src/config/environment.js';
import { PLANET_LOWRES_TEXTURE_PATHS, PLANET_TEXTURE_PATHS } from '../../src/assets/planets.js';

describe('CELESTIAL_ENVIRONMENT planet textures', () => {
  it('references only registered planet texture keys', () => {
    for (const planet of CELESTIAL_ENVIRONMENT.planets) {
      expect(Object.prototype.hasOwnProperty.call(PLANET_TEXTURE_PATHS, planet.textureKey)).toBe(
        true,
      );
      expect(
        Object.prototype.hasOwnProperty.call(PLANET_LOWRES_TEXTURE_PATHS, planet.textureKey),
      ).toBe(true);
    }
  });
});

describe('CELESTIAL_ENVIRONMENT planet atmosphere', () => {
  it('enables the planet atmosphere feature flag', () => {
    expect(CELESTIAL_ENVIRONMENT.features?.planetAtmosphere).toBe(true);
  });

  it('configures a tunable atmosphere shell for at least one planet', () => {
    const withAtmosphere = CELESTIAL_ENVIRONMENT.planets.filter(
      (planet) => (planet.atmosphereStrength ?? 0) > 0,
    );

    expect(withAtmosphere.length).toBeGreaterThan(0);

    for (const planet of withAtmosphere) {
      expect(planet.atmosphereStrength).toBeGreaterThan(0);
      expect(typeof planet.atmosphereColor).toBe('string');
      expect(planet.atmosphereFalloff).toBeGreaterThan(0);
    }
  });

  it('keeps the atmosphere shell scale within the documented 1.03–1.06 range', () => {
    expect(PLANET_ATMOSPHERE_SHELL_SCALE).toBeGreaterThanOrEqual(1.03);
    expect(PLANET_ATMOSPHERE_SHELL_SCALE).toBeLessThanOrEqual(1.06);
  });

  it('wires the atmosphere shaders with fresnel and forward-scatter terms', () => {
    const fragment = fs.readFileSync(
      path.resolve(__dirname, '../../src/renderer/shaders/planetAtmosphere.fragment.glsl'),
      'utf-8',
    );
    expect(fragment).toContain('uAtmosphereFalloff');
    expect(fragment).toContain('uLightDir');
    expect(fragment).toContain('max(dot(normal, lightDir), 0.0)');

    const component = fs.readFileSync(
      path.resolve(__dirname, '../../src/components/environment/PlanetAtmosphere.tsx'),
      'utf-8',
    );
    expect(component).toContain('depthTest: true');
    expect(component).toContain('depthWrite: false');
    expect(component).toContain('AdditiveBlending');
    expect(component).toContain('DoubleSide');
  });
});
