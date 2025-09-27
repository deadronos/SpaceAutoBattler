import starOrganicUrl from './textures/star/star-organic.png';
import starNoiseRgbaUrl from './textures/star/star-noise-rgba.png';

export const STAR_DISK_TEXTURE_PATHS = {
  organic: starOrganicUrl,
  noiseRgba: starNoiseRgbaUrl,
} as const;

export type StarDiskTextureKey = keyof typeof STAR_DISK_TEXTURE_PATHS;
