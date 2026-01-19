import { useEffect, useMemo, useState } from 'react';
import { useThree } from '@react-three/fiber';
import type { WebGLRenderer } from 'three';
import {
  LinearFilter,
  LinearMipmapLinearFilter,
  SRGBColorSpace,
  Texture,
  TextureLoader,
} from 'three';
import {
  PLANET_TEXTURE_PATHS,
  PLANET_LOWRES_TEXTURE_PATHS,
  type PlanetTextureKey,
} from '../assets/planets.js';
import { applyTextureSettings, computeMaxAnisotropy } from '../utils/textureUtils.js';

const FALLBACK_COLOR = '#2e3142';

export interface PlanetTextureResult {
  texture: Texture | null;
  error?: Error;
  fallbackColor: string;
  isHighResLoaded?: boolean;
}

const APPLY_MAX_ANISOTROPY = 16;

/**
 * Hook for loading planet textures with progressive loading support.
 * Loads low-res textures first, then upgrades to high-res in the background.
 */
export function usePlanetTexture(key: PlanetTextureKey | undefined): PlanetTextureResult {
  const { gl } = useThree();
  const [textures, setTextures] = useState<Record<string, Texture>>({});
  const [isHighResLoaded, setIsHighResLoaded] = useState(false);

  useEffect(() => {
    const loader = new TextureLoader();
    const loadedTextures: Record<string, Texture> = {};
    const lowResUrls = Object.entries(PLANET_LOWRES_TEXTURE_PATHS);
    const highResUrls = Object.entries(PLANET_TEXTURE_PATHS);
    let disposed = false;

    // Load all low-res textures first
    const lowResPromises = lowResUrls.map(([textureKey, url]) => {
      return new Promise<void>((resolve) => {
        loader.load(
          url,
          (texture) => {
            if (!disposed) {
              loadedTextures[textureKey] = texture;
              applyTextureSettings(
                texture,
                {
                  colorSpace: SRGBColorSpace,
                  minFilter: LinearMipmapLinearFilter,
                  magFilter: LinearFilter,
                  anisotropy: computeMaxAnisotropy(
                    gl as WebGLRenderer | undefined,
                    APPLY_MAX_ANISOTROPY,
                  ),
                  needsUpdate: true,
                },
                gl as WebGLRenderer | undefined,
              );
            }
            resolve();
          },
          undefined,
          (error) => {
            console.warn(`[usePlanetTexture] Failed to load low-res texture ${textureKey}:`, error);
            resolve();
          },
        );
      });
    });

    // Load low-res first
    Promise.all(lowResPromises).then(() => {
      if (!disposed) {
        setTextures({ ...loadedTextures });

        // Then load high-res textures in the background
        highResUrls.forEach(([textureKey, url]) => {
          loader.load(
            url,
            (texture) => {
              if (!disposed) {
                // Dispose low-res texture
                if (loadedTextures[textureKey]) {
                  loadedTextures[textureKey].dispose();
                }
                loadedTextures[textureKey] = texture;
                applyTextureSettings(
                  texture,
                  {
                    colorSpace: SRGBColorSpace,
                    minFilter: LinearMipmapLinearFilter,
                    magFilter: LinearFilter,
                    anisotropy: computeMaxAnisotropy(
                      gl as WebGLRenderer | undefined,
                      APPLY_MAX_ANISOTROPY,
                    ),
                    needsUpdate: true,
                  },
                  gl as WebGLRenderer | undefined,
                );
                setTextures({ ...loadedTextures });

                // Check if all high-res textures are loaded
                const allHighResLoaded = highResUrls.every(([k]) => loadedTextures[k]);
                if (allHighResLoaded) {
                  setIsHighResLoaded(true);
                }
              }
            },
            undefined,
            (error) => {
              console.warn(
                `[usePlanetTexture] Failed to load high-res texture ${textureKey}:`,
                error,
              );
            },
          );
        });
      }
    });

    return () => {
      disposed = true;
      Object.values(loadedTextures).forEach((texture) => {
        texture.dispose();
      });
    };
  }, [gl]);

  return useMemo(() => {
    if (!key) {
      return { texture: null, fallbackColor: FALLBACK_COLOR };
    }

    // Textures are loaded asynchronously; on first renders a valid key will not
    // have a value in `textures` yet. Only treat keys as invalid if they don't
    // exist in the canonical registry.
    if (!Object.prototype.hasOwnProperty.call(PLANET_TEXTURE_PATHS, key)) {
      return {
        texture: null,
        fallbackColor: FALLBACK_COLOR,
        error: new Error(`Unknown planet texture key: ${key}`),
        isHighResLoaded: false,
      };
    }

    return { texture: textures[key] ?? null, fallbackColor: FALLBACK_COLOR, isHighResLoaded };
  }, [key, textures, isHighResLoaded]);
}
