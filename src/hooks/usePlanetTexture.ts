import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import { LinearFilter, LinearMipmapLinearFilter, SRGBColorSpace, Texture } from 'three';
import { PLANET_TEXTURE_PATHS, type PlanetTextureKey } from '../assets/planets.js';

const FALLBACK_COLOR = '#2e3142';

export interface PlanetTextureResult {
  texture: Texture | null;
  error?: Error;
  fallbackColor: string;
}

const APPLY_MAX_ANISOTROPY = 16;

export function usePlanetTexture(key: PlanetTextureKey | undefined): PlanetTextureResult {
  const textures = useTexture(PLANET_TEXTURE_PATHS) as Record<PlanetTextureKey, Texture>;
  const { gl } = useThree();

  useEffect(() => {
    const maxAniso = Math.min(APPLY_MAX_ANISOTROPY, gl.capabilities.getMaxAnisotropy());
    for (const texture of Object.values(textures)) {
      texture.colorSpace = SRGBColorSpace;
      texture.minFilter = LinearMipmapLinearFilter;
      texture.magFilter = LinearFilter;
      texture.anisotropy = maxAniso;
      texture.needsUpdate = true;
    }
  }, [textures, gl]);

  return useMemo(() => {
    if (!key) {
      return { texture: null, fallbackColor: FALLBACK_COLOR };
    }

    const texture = textures[key];
    if (!texture) {
      return {
        texture: null,
        fallbackColor: FALLBACK_COLOR,
        error: new Error(`Unknown planet texture key: ${key}`),
      };
    }

    return { texture, fallbackColor: FALLBACK_COLOR };
  }, [key, textures]);
}
