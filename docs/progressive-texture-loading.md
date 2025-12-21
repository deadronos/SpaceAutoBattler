# Progressive Texture Loading

## Overview

Progressive texture loading improves initial load time by loading low-resolution textures first, then upgrading to high-resolution textures in the background. This provides a better user experience, especially on slow connections.

## Implementation

### Asset Strategy

We maintain two versions of each texture:
- **Low-res**: Fast to load, displayed immediately
- **High-res**: Full quality, loaded in background

| Asset | Low-Res | High-Res | Size Reduction |
|-------|---------|----------|----------------|
| Skysphere | 2048x1024 (1.3MB) | 8192x4096 (8.2MB) | ~84% |
| Ice Planet | 512x256 (173KB) | 2048x1024 (2.37MB) | ~93% |
| Gas Giant | 512x256 (123KB) | 2048x1024 (735KB) | ~83% |

**Total initial load reduction**: ~9.67 MB deferred to background

### Hook: `useProgressiveTexture`

Located in `src/hooks/useProgressiveTexture.ts`

```typescript
const { texture, isHighResLoaded, progress } = useProgressiveTexture(
  lowResUrl,
  highResUrl
);
```

**Returns:**
- `texture`: Current texture (low-res initially, then high-res)
- `isHighResLoaded`: Boolean indicating if high-res is loaded
- `progress`: Loading progress (0-100)

**Behavior:**
1. Immediately loads low-res texture via `useLoader` (blocking)
2. Starts async load of high-res texture via `TextureLoader`
3. Swaps to high-res when loaded
4. Disposes low-res texture to free memory

### Usage Examples

#### Skysphere Component

```typescript
import { useProgressiveTexture } from '../../hooks/useProgressiveTexture.js';
import { SKYSPHERE_TEXTURE_PATHS, SKYSPHERE_LOWRES_TEXTURE_PATHS } from '../../assets/skysphere.js';

const { texture } = useProgressiveTexture(
  SKYSPHERE_LOWRES_TEXTURE_PATHS[textureKey],
  SKYSPHERE_TEXTURE_PATHS[textureKey]
);
```

#### Planet Textures

The `usePlanetTexture` hook has been refactored to automatically use progressive loading:

```typescript
import { usePlanetTexture } from '../../hooks/usePlanetTexture.js';

const { texture, isHighResLoaded } = usePlanetTexture('icePlanet1');
```

## Performance Impact

### Before Progressive Loading
- Initial load: ~11.27 MB of textures
- Blocking load time: 3-8 seconds on slow connections

### After Progressive Loading
- Initial load: ~1.6 MB of low-res textures
- Background load: ~9.67 MB of high-res textures
- Initial display time: 0.5-2 seconds (improved by 3-5 seconds)

## Memory Management

The implementation includes proper memory management:

1. **Low-res disposal**: Low-res textures are automatically disposed when high-res loads
2. **Cleanup on unmount**: Textures are disposed if component unmounts during loading
3. **No leaks**: All texture references are properly cleaned up

## Testing

### Unit Tests

Tests are located in `test/vitest/progressive-texture.spec.ts`:
- Texture loading behavior
- Progress tracking
- State management
- Memory cleanup

### Manual Testing

To test with network throttling:

1. Build the project: `npm run build`
2. Serve the dist folder: `npm run serve`
3. Open Chrome DevTools → Network tab
4. Select "Slow 3G" or "Fast 3G" throttling
5. Reload the page and observe:
   - Low-res textures appear quickly
   - High-res textures load in background
   - No visual "pop" during transition

## Adding New Textures

To add progressive loading for new textures:

1. **Generate low-res variant** using ImageMagick:
   ```bash
   convert input-high-res.png -resize 512x256 -quality 95 input-low-res.png
   ```

2. **Update asset registry**:
   ```typescript
   // In src/assets/yourTextures.ts
   export const YOUR_TEXTURE_PATHS = {
     myTexture: highResUrl,
   };
   
   export const YOUR_LOWRES_TEXTURE_PATHS = {
     myTexture: lowResUrl,
   };
   ```

3. **Use in component**:
   ```typescript
   const { texture } = useProgressiveTexture(
     YOUR_LOWRES_TEXTURE_PATHS.myTexture,
     YOUR_TEXTURE_PATHS.myTexture
   );
   ```

## Future Enhancements

Potential improvements:
- Loading progress UI indicator
- Configurable fade transitions between resolutions
- Adaptive quality based on connection speed
- WebP format for better compression
- Texture streaming for extremely large assets
