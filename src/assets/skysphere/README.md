# assets/skysphere/ - Skysphere Assets

Skysphere background images and configuration.

## Skysphere Files

| File                                   | Purpose                                                   |
| -------------------------------------- | --------------------------------------------------------- |
| **rich_blue_nebulae_2_2048_1024.webp** | Low-res texture, loaded first on every quality tier       |
| **rich_blue_nebulae_2_4096_2048.webp** | High-res upgrade for the `medium` tier                    |
| **rich_blue_nebulae_2_8192_4096.webp** | High-res upgrade for the `high` tier (GPU limit allowing) |

The upgrade is chosen by `selectSkysphereHighResUrl` in `../skysphere.ts` from the tier's
`skysphereMaxSize` (`src/config/quality.ts`). The WebPs are lossy q92 encodes of the original
PNGs (PSNR ≈ 47 dB); the PNG sources remain in git history.

## File Structure

| Item                | Purpose                     |
| ------------------- | --------------------------- |
| **attribution.txt** | Credits for skysphere asset |

## Skysphere Usage

The skysphere texture is:

- Loaded as a cubemap or 360° panorama
- Used as far-field background
- Wrapped around the scene at maximum distance
- Provides visual context and atmosphere

## Performance

- High resolution for visual quality
- Applied as single texture to large sphere
- Culling ensures not rendered in front of objects
