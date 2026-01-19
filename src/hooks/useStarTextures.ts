/**
 * Star disk texture loading and configuration hook
 *
 * Handles loading textures from asset paths and configuring them with appropriate
 * filters, wrapping modes, anisotropy, and color spaces for star disk rendering.
 */

import { useEffect } from 'react';
import { useTexture } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import type { Texture } from 'three';
import {
  RepeatWrapping,
  ClampToEdgeWrapping,
  LinearFilter,
  LinearMipmapLinearFilter,
  NearestFilter,
  SRGBColorSpace,
} from 'three';
import { STAR_DISK_TEXTURE_PATHS, type StarDiskTextureKey } from '../assets/starDiskTextures.js';
import { applyTextureSettings, computeMaxAnisotropy } from '../utils/textureUtils.js';

/**
 * Load and configure star disk textures.
 *
 * @returns Object containing organic and noise textures (may be undefined if not loaded)
 */
export function useStarTextures(): {
  organic: Texture | undefined;
  noise: Texture | undefined;
} {
  const { gl } = useThree();
  const starTextures = useTexture(STAR_DISK_TEXTURE_PATHS) as Record<
    StarDiskTextureKey,
    Texture | undefined
  >;
  const organicTexture = starTextures.organic;
  const noiseTexture = starTextures.noiseRgba;

  useEffect(() => {
    if (!gl) return;

    if (organicTexture) {
      applyTextureSettings(
        organicTexture,
        {
          wrapS: RepeatWrapping,
          wrapT: ClampToEdgeWrapping,
          minFilter: LinearMipmapLinearFilter,
          magFilter: LinearFilter,
          anisotropy: computeMaxAnisotropy(gl, 8),
          colorSpace: SRGBColorSpace,
          needsUpdate: true,
        },
        gl,
      );
    }

    if (noiseTexture) {
      applyTextureSettings(
        noiseTexture,
        {
          wrapS: RepeatWrapping,
          wrapT: RepeatWrapping,
          minFilter: NearestFilter,
          magFilter: NearestFilter,
          generateMipmaps: false,
          needsUpdate: true,
        },
        gl,
      );
    }
  }, [gl, organicTexture, noiseTexture]);

  return {
    organic: organicTexture,
    noise: noiseTexture,
  };
}
