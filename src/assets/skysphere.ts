import skysphere2kUrl from './skysphere/rich_blue_nebulae_2_2048_1024.webp';
import skysphere4kUrl from './skysphere/rich_blue_nebulae_2_4096_2048.webp';
import skysphere8kUrl from './skysphere/rich_blue_nebulae_2_8192_4096.webp';

/** Width in pixels of every low-res skysphere texture (loaded first, on every tier). */
export const SKYSPHERE_LOWRES_WIDTH = 2048;

export const SKYSPHERE_LOWRES_TEXTURE_PATHS = {
  richBlueNebulae: skysphere2kUrl,
} as const;

/** High-res upgrade variants keyed by texture width in pixels. */
export const SKYSPHERE_HIGHRES_TEXTURE_PATHS = {
  richBlueNebulae: { 4096: skysphere4kUrl, 8192: skysphere8kUrl },
} as const satisfies Record<string, Record<number, string>>;

export type SkyspherTextureKey = keyof typeof SKYSPHERE_LOWRES_TEXTURE_PATHS;

/**
 * Pick the high-res upgrade for a skysphere: the widest variant that fits both the quality
 * tier's budget and the GPU's `maxTextureSize`. Returns null when nothing wider than the
 * low-res texture fits, so the caller can skip the upgrade entirely.
 */
export function selectSkysphereHighResUrl(
  key: SkyspherTextureKey,
  tierMaxSize: number,
  gpuMaxTextureSize: number | undefined,
): string | null {
  const limit = Math.min(tierMaxSize, gpuMaxTextureSize ?? Number.POSITIVE_INFINITY);
  const variants: Record<number, string> = SKYSPHERE_HIGHRES_TEXTURE_PATHS[key];
  const best = Object.keys(variants)
    .map(Number)
    .filter((width) => width > SKYSPHERE_LOWRES_WIDTH && width <= limit)
    .sort((a, b) => b - a)[0];
  return best === undefined ? null : (variants[best] ?? null);
}
