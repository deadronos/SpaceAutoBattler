import { describe, expect, it } from 'vitest';
import { CELESTIAL_ENVIRONMENT } from '../../src/config/environment.js';
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
