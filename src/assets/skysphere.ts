import skyspherePngUrl from './skysphere/rich_blue_nebulae_2_8192_4096.png';

export const SKYSPHERE_TEXTURE_PATHS = {
  richBlueNebulae: skyspherePngUrl,
} as const;

export type SkyspherTextureKey = keyof typeof SKYSPHERE_TEXTURE_PATHS;
