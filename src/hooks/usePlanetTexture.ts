import { useEffect, useMemo, useState } from 'react';
import { useThree } from '@react-three/fiber';
import type { WebGLRenderer } from 'three';
import { LinearFilter, LinearMipmapLinearFilter, SRGBColorSpace, Texture, TextureLoader } from 'three';
import { PLANET_TEXTURE_PATHS, PLANET_LOWRES_TEXTURE_PATHS, type PlanetTextureKey } from '../assets/planets.js';

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
              configureTexture(texture, gl);
            }
            resolve();
          },
          undefined,
          (error) => {
            console.warn(`[usePlanetTexture] Failed to load low-res texture ${textureKey}:`, error);
            resolve();
          }
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
                configureTexture(texture, gl);
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
              console.warn(`[usePlanetTexture] Failed to load high-res texture ${textureKey}:`, error);
            }
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

    const texture = textures[key];
    if (!texture) {
      return {
        texture: null,
        fallbackColor: FALLBACK_COLOR,
        error: new Error(`Unknown planet texture key: ${key}`),
        isHighResLoaded: false,
      };
    }

    return { texture, fallbackColor: FALLBACK_COLOR, isHighResLoaded };
  }, [key, textures, isHighResLoaded]);
}

function configureTexture(texture: Texture, gl: WebGLRenderer): void {
  const maxAniso = Math.min(APPLY_MAX_ANISOTROPY, gl.capabilities.getMaxAnisotropy());
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.anisotropy = maxAniso;
  texture.needsUpdate = true;
}
