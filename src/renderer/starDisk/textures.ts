import {
  ClampToEdgeWrapping,
  DataTexture,
  LinearFilter,
  NearestFilter,
  RepeatWrapping,
  RGBAFormat,
  SRGBColorSpace,
  Texture,
  UnsignedByteType,
} from 'three';
import { applyTextureSettings } from '../../utils/textureUtils.js';

export const FALLBACK_ORGANIC = (() => {
  const data = new Uint8Array([
    255, 220, 140, 255, 240, 180, 80, 255, 255, 200, 100, 255, 250, 160, 60, 255, 200, 120, 40, 255,
    150, 80, 30, 255, 180, 100, 45, 255, 220, 140, 70, 255, 80, 40, 20, 255, 60, 30, 15, 255, 100,
    50, 25, 255, 120, 60, 30, 255, 40, 20, 10, 255, 160, 80, 20, 255, 90, 45, 15, 255, 200, 100, 30,
    255,
  ]);
  const texture = new DataTexture(data, 4, 4, RGBAFormat, UnsignedByteType);
  texture.name = 'MainSequenceOrganicFallback';
  applyTextureSettings(texture, {
    wrapS: RepeatWrapping,
    wrapT: ClampToEdgeWrapping,
    minFilter: LinearFilter,
    magFilter: LinearFilter,
    colorSpace: SRGBColorSpace,
    needsUpdate: true,
  });
  return texture;
})();

export const FALLBACK_NOISE = (() => {
  const data = new Uint8Array([
    255, 200, 100, 255, 80, 40, 20, 255, 220, 160, 60, 255, 40, 20, 10, 255, 200, 120, 40, 255, 60,
    30, 15, 255, 180, 140, 80, 255, 100, 50, 25, 255, 240, 180, 90, 255, 70, 35, 18, 255, 160, 100,
    50, 255, 90, 45, 22, 255, 210, 140, 70, 255, 50, 25, 12, 255, 150, 90, 45, 255, 120, 70, 35,
    255,
  ]);
  const texture = new DataTexture(data, 4, 4, RGBAFormat, UnsignedByteType);
  texture.name = 'MainSequenceNoiseFallback';
  applyTextureSettings(texture, {
    wrapS: RepeatWrapping,
    wrapT: RepeatWrapping,
    minFilter: NearestFilter,
    magFilter: NearestFilter,
    generateMipmaps: false,
    needsUpdate: true,
  });
  return texture;
})();

export const resolveTexture = (texture: Texture | null | undefined, fallback: Texture): Texture =>
  texture ?? fallback;
