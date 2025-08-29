// SVG Raster Worker - Converts SVG text to ImageBitmap with caching and change detection
// Runs in Web Worker to avoid blocking main thread during rasterization

interface RasterizeRequest {
  type: 'rasterize';
  svgText: string;
  width: number;
  height: number;
  assetKey: string;
  teamColor?: string;
  filePath?: string;
  fileModTime?: number;
}

interface CacheRequest {
  type: 'clear-cache' | 'set-cache-max-entries' | 'set-cache-max-age';
  value?: number;
}

interface GetCanvasRequest {
  type: 'get-canvas';
  assetKey: string;
  mappingHash: string;
  outW: number;
  outH: number;
}

type WorkerRequest = RasterizeRequest | CacheRequest | GetCanvasRequest;

interface RasterizeResponse {
  type: 'rasterized';
  assetKey: string;
  imageBitmap: ImageBitmap;
  width: number;
  height: number;
}

interface CacheResponse {
  type: 'cache-cleared' | 'cache-config-updated';
}

interface GetCanvasResponse {
  type: 'canvas-result';
  assetKey: string;
  canvas: OffscreenCanvas;
  present: boolean;
}

type WorkerResponse = RasterizeResponse | CacheResponse | GetCanvasResponse;

// Simple LRU cache for rasterized SVGs
class RasterCache {
  private cache = new Map<string, { bitmap: ImageBitmap; timestamp: number; modTime?: number }>();
  private maxEntries = 50;
  private maxAge = 300000; // 5 minutes

  set(assetKey: string, bitmap: ImageBitmap, modTime?: number) {
    // Clean up old entries if needed
    if (this.cache.size >= this.maxEntries) {
      this.evictOldest();
    }

    this.cache.set(assetKey, {
      bitmap,
      timestamp: Date.now(),
      modTime
    });
  }

  get(assetKey: string, modTime?: number): ImageBitmap | null {
    const entry = this.cache.get(assetKey);
    if (!entry) return null;

    // Check if cache entry is stale
    if (Date.now() - entry.timestamp > this.maxAge) {
      this.cache.delete(assetKey);
      return null;
    }

    // Check if file has been modified since caching
    if (modTime && entry.modTime && modTime > entry.modTime) {
      this.cache.delete(assetKey);
      return null;
    }

    return entry.bitmap;
  }

  clear() {
    // Close all ImageBitmaps to free memory
    for (const entry of this.cache.values()) {
      entry.bitmap.close();
    }
    this.cache.clear();
  }

  setMaxEntries(max: number) {
    this.maxEntries = max;
    // Evict excess entries
    while (this.cache.size > this.maxEntries) {
      this.evictOldest();
    }
  }

  setMaxAge(maxAgeMs: number) {
    this.maxAge = maxAgeMs;
  }

  private evictOldest() {
    let oldestKey = '';
    let oldestTime = Date.now();

    for (const [key, entry] of this.cache) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      const entry = this.cache.get(oldestKey);
      if (entry) {
        entry.bitmap.close();
      }
      this.cache.delete(oldestKey);
    }
  }
}

const rasterCache = new RasterCache();

// SVG to ImageBitmap rasterization function
async function rasterizeSvgToImageBitmap(
  svgText: string,
  width: number,
  height: number,
  teamColor?: string
): Promise<ImageBitmap> {
  // Create canvas for rasterization
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d')!;

  // Clear canvas
  ctx.clearRect(0, 0, width, height);

  try {
    // Create SVG blob and convert it to ImageBitmap
    const svgBlob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
    
    // Try creating ImageBitmap directly from the SVG blob
    const imageBitmap = await createImageBitmap(svgBlob, {
      resizeWidth: width,
      resizeHeight: height,
      resizeQuality: 'high'
    });

    // Draw the ImageBitmap to canvas
    ctx.drawImage(imageBitmap, 0, 0, width, height);

    // Clean up the intermediate ImageBitmap
    imageBitmap.close();

    // Apply team color tinting if specified
    if (teamColor) {
      applyTeamColorTint(ctx, width, height, teamColor);
    }

    // Convert canvas to ImageBitmap
    return canvas.transferToImageBitmap();
  } catch (error) {
    throw new Error(`Failed to rasterize SVG: ${error.message}`);
  }
}

// Apply team color tinting to the rasterized SVG
function applyTeamColorTint(
  ctx: OffscreenCanvasRenderingContext2D,
  width: number,
  height: number,
  teamColor: string
) {
  // Get image data
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  // Parse team color
  const colorMatch = teamColor.match(/^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!colorMatch) return;

  const r = parseInt(colorMatch[1], 16) / 255;
  const g = parseInt(colorMatch[2], 16) / 255;
  const b = parseInt(colorMatch[3], 16) / 255;

  // Apply tint to non-transparent pixels
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3];
    if (alpha > 0) {
      // Blend with team color
      data[i] = Math.min(255, data[i] * r);     // Red
      data[i + 1] = Math.min(255, data[i + 1] * g); // Green
      data[i + 2] = Math.min(255, data[i + 2] * b); // Blue
      // Alpha remains unchanged
    }
  }

  // Put modified image data back
  ctx.putImageData(imageData, 0, 0);
}

// Get file modification time (simplified - in real implementation would need file system access)
async function getFileModTime(filePath: string): Promise<number | null> {
  // This is a placeholder - in a real implementation, you'd need to check file system
  // For now, we'll use a simple approach that could be extended
  try {
    // In a browser environment, we can't directly access file modification times
    // This would need to be implemented server-side or with a different approach
    return null;
  } catch {
    return null;
  }
}

// Handle worker messages
self.addEventListener('message', async (e: MessageEvent<WorkerRequest>) => {
  const request = e.data;

  try {
    switch (request.type) {
      case 'rasterize': {
        const { svgText, width, height, assetKey, teamColor, filePath, fileModTime } = request;

        // Check cache first
        const cached = rasterCache.get(assetKey, fileModTime || undefined);
        if (cached) {
          (self as any).postMessage({
            type: 'rasterized',
            assetKey,
            imageBitmap: cached,
            width,
            height
          } as RasterizeResponse);
          return;
        }

        // Rasterize SVG
        const imageBitmap = await rasterizeSvgToImageBitmap(svgText, width, height, teamColor);

        // Cache the result
        rasterCache.set(assetKey, imageBitmap, fileModTime);

        // Send response
        (self as any).postMessage({
          type: 'rasterized',
          assetKey,
          imageBitmap,
          width,
          height
        } as RasterizeResponse);
        break;
      }

      case 'get-canvas': {
        // This is a simplified implementation - in practice you'd maintain a canvas cache
        const { assetKey, mappingHash, outW, outH } = request;

        // For now, just return whether we have a cached bitmap
        const cached = rasterCache.get(assetKey);
        const canvas = new OffscreenCanvas(outW, outH);

        if (cached) {
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(cached, 0, 0, outW, outH);
        }

        (self as any).postMessage({
          type: 'canvas-result',
          assetKey,
          canvas,
          present: !!cached
        } as GetCanvasResponse);
        break;
      }

      case 'clear-cache': {
        rasterCache.clear();
        (self as any).postMessage({ type: 'cache-cleared' } as CacheResponse);
        break;
      }

      case 'set-cache-max-entries': {
        if (request.value !== undefined) {
          rasterCache.setMaxEntries(request.value);
          (self as any).postMessage({ type: 'cache-config-updated' } as CacheResponse);
        }
        break;
      }

      case 'set-cache-max-age': {
        if (request.value !== undefined) {
          rasterCache.setMaxAge(request.value);
          (self as any).postMessage({ type: 'cache-config-updated' } as CacheResponse);
        }
        break;
      }
    }
  } catch (error) {
    console.error('[svgRasterWorker] Error processing request:', error);
    // Send error response if needed
  }
});

export {};