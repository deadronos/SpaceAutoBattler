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
    const maxAniso = Math.min(8, gl.capabilities.getMaxAnisotropy());

    if (organicTexture) {
      organicTexture.wrapS = RepeatWrapping;
      organicTexture.wrapT = ClampToEdgeWrapping;
      organicTexture.minFilter = LinearMipmapLinearFilter;
      organicTexture.magFilter = LinearFilter;
      organicTexture.anisotropy = maxAniso;
      organicTexture.colorSpace = SRGBColorSpace;
      organicTexture.needsUpdate = true;
    }

    if (noiseTexture) {
      noiseTexture.wrapS = RepeatWrapping;
      noiseTexture.wrapT = RepeatWrapping;
      noiseTexture.minFilter = NearestFilter;
      noiseTexture.magFilter = NearestFilter;
      noiseTexture.generateMipmaps = false;
      noiseTexture.needsUpdate = true;
    }
  }, [gl, organicTexture, noiseTexture]);

  return {
    organic: organicTexture,
    noise: noiseTexture,
  };
}
