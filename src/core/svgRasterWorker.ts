// Implementation of the SVG raster worker. This file contains the actual
// rasterization logic. It posts structured error messages back to the main
// thread on unhandled errors so the app can log stacks and fallback.

import * as logger from '../utils/logger.js';

// Diagnostic checkpoints: these post small messages to the main thread during
// module evaluation so we can see where initialization fails (if it does).
try {
  (self as unknown as { postMessage?: (m: unknown) => void }).postMessage?.({ type: 'worker-checkpoint', name: 'module-eval-start' });
} catch { /* ignore */ }

// Simple LRU cache for rasterized SVGs
class RasterCache {
  private cache = new Map<string, { bitmap: ImageBitmap; timestamp: number; modTime?: number }>();
  private maxEntries = 50;
  private maxAge = 300000; // 5 minutes

  set(assetKey: string, bitmap: ImageBitmap, modTime?: number) {
    if (this.cache.size >= this.maxEntries) this.evictOldest();
    this.cache.set(assetKey, { bitmap, timestamp: Date.now(), modTime });
  }

  get(assetKey: string, modTime?: number): ImageBitmap | null {
    const entry = this.cache.get(assetKey);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > this.maxAge) {
      this.cache.delete(assetKey);
      return null;
    }
    if (modTime && entry.modTime && modTime > entry.modTime) {
      this.cache.delete(assetKey);
      return null;
    }
    return entry.bitmap;
  }

  clear() {
    for (const entry of this.cache.values()) entry.bitmap.close();
    this.cache.clear();
  }

  setMaxEntries(max: number) {
    this.maxEntries = max;
    while (this.cache.size > this.maxEntries) this.evictOldest();
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
      if (entry) entry.bitmap.close();
      this.cache.delete(oldestKey);
    }
  }
}

const rasterCache = new RasterCache();
try {
  (self as unknown as { postMessage?: (m: unknown) => void }).postMessage?.({ type: 'worker-checkpoint', name: 'raster-cache-created' });
} catch { /* ignore */ }

async function rasterizeSvgToImageBitmap(svgText: string, width: number, height: number, teamColor?: string): Promise<ImageBitmap> {
  const canvas = new OffscreenCanvas(width, height);
  const ctx = (canvas.getContext('2d', { willReadFrequently: true } as unknown) as OffscreenCanvasRenderingContext2D) || canvas.getContext('2d')!;
  ctx.clearRect(0, 0, width, height);

  try {
    const svgBlob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
    const imageBitmap = await createImageBitmap(svgBlob, { resizeWidth: width, resizeHeight: height, resizeQuality: 'high' });
    ctx.drawImage(imageBitmap, 0, 0, width, height);
    if (teamColor) applyTeamColorTint(ctx, width, height, teamColor);
    imageBitmap.close();
    return canvas.transferToImageBitmap();
  } catch (err) {
    logger.debug('[svgRasterWorker] SVG rasterization failed, using geometric fallback:', err);
    const centerX = width / 2;
    const centerY = height / 2;
    const size = Math.min(width, height) * 0.8;
    if (teamColor) {
      ctx.fillStyle = teamColor;
      ctx.globalAlpha = 0.3;
      ctx.fillRect(0, 0, width, height);
      ctx.globalAlpha = 1.0;
    }
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - size/2);
    ctx.lineTo(centerX + size/4, centerY);
    ctx.lineTo(centerX + size/6, centerY + size/3);
    ctx.lineTo(centerX - size/6, centerY + size/3);
    ctx.lineTo(centerX - size/4, centerY);
    ctx.closePath();
    ctx.fill();
    if (teamColor) {
      ctx.strokeStyle = teamColor;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    return canvas.transferToImageBitmap();
  }
}

try {
  (self as unknown as { postMessage?: (m: unknown) => void }).postMessage?.({ type: 'worker-checkpoint', name: 'rasterize-fn-defined' });
} catch { /* ignore */ }

function applyTeamColorTint(ctx: OffscreenCanvasRenderingContext2D, width: number, height: number, teamColor: string) {
  try {
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = teamColor;
    ctx.fillRect(0, 0, width, height);
  } finally { ctx.restore(); }
}

type RasterizeRequest = { type: 'rasterize'; svgText: string; width: number; height: number; assetKey: string; teamColor?: string; filePath?: string; fileModTime?: number };
type CacheRequest = { type: 'clear-cache' | 'set-cache-max-entries' | 'set-cache-max-age'; value?: number };
type GetCanvasRequest = { type: 'get-canvas'; assetKey: string; mappingHash: string; outW: number; outH: number };
type WorkerRequest = RasterizeRequest | CacheRequest | GetCanvasRequest;

type RasterizeResponse = { type: 'rasterized'; assetKey: string; imageBitmap: ImageBitmap; width: number; height: number };
type CacheResponse = { type: 'cache-cleared' | 'cache-config-updated' };
type GetCanvasResponse = { type: 'canvas-result'; assetKey: string; canvas: OffscreenCanvas; present: boolean };

self.addEventListener('message', async (e: MessageEvent<WorkerRequest>) => {
  const request = e.data;
  try {
    switch (request.type) { 
      case 'rasterize': {
        const { svgText, width, height, assetKey, teamColor, filePath: _fp, fileModTime } = request;
        const cached = rasterCache.get(assetKey, fileModTime || undefined);
        if (cached) {
          (self as unknown as { postMessage(m: unknown): void }).postMessage({ type: 'rasterized', assetKey, imageBitmap: cached, width, height } as RasterizeResponse);
          return;
        }
        const imageBitmap = await rasterizeSvgToImageBitmap(svgText, width, height, teamColor);
        rasterCache.set(assetKey, imageBitmap, fileModTime);
        (self as unknown as { postMessage(m: unknown): void }).postMessage({ type: 'rasterized', assetKey, imageBitmap, width, height } as RasterizeResponse);
        break;
      }
      case 'get-canvas': {
        const { assetKey, mappingHash: _mh, outW, outH } = request;
        const cached = rasterCache.get(assetKey);
        const canvas = new OffscreenCanvas(outW, outH);
        if (cached) { const ctx = canvas.getContext('2d')!; ctx.drawImage(cached, 0, 0, outW, outH); }
        (self as unknown as { postMessage(m: unknown): void }).postMessage({ type: 'canvas-result', assetKey, canvas, present: !!cached } as GetCanvasResponse);
        break;
      }
      case 'clear-cache': {
        rasterCache.clear();
        (self as unknown as { postMessage(m: unknown): void }).postMessage({ type: 'cache-cleared' } as CacheResponse);
        break;
      }
      case 'set-cache-max-entries': {
        if (request.value !== undefined) { rasterCache.setMaxEntries(request.value); (self as unknown as { postMessage(m: unknown): void }).postMessage({ type: 'cache-config-updated' } as CacheResponse); }
        break;
      }
      case 'set-cache-max-age': {
        if (request.value !== undefined) { rasterCache.setMaxAge(request.value); (self as unknown as { postMessage(m: unknown): void }).postMessage({ type: 'cache-config-updated' } as CacheResponse); }
        break;
      }
    }
  } catch (err) {
    void err;
    logger.error('[svgRasterWorker.impl] Error processing request:', err);
    try {
      const msg = err instanceof Error ? err.message : String(err);
      const stack = (err && (err as unknown as { stack?: string }).stack) ? (err as unknown as { stack?: string }).stack : undefined;
      (self as unknown as { postMessage(m: unknown): void }).postMessage({ type: 'worker-error', message: msg, stack });
    } catch { /* ignore */ }
  }
});
try {
  (self as unknown as { postMessage?: (m: unknown) => void }).postMessage?.({ type: 'worker-checkpoint', name: 'message-listener-attached' });
} catch { /* ignore */ }

self.addEventListener('error', (e: ErrorEvent) => {
  try {
    const msg = e.message || String(e);
    const stack = (e.error && (e.error as unknown as { stack?: string }).stack) ? (e.error as unknown as { stack?: string }).stack : `${e.filename || ''}:${e.lineno || 0}:${e.colno || 0}`;
    logger.error('[svgRasterWorker.impl] Uncaught error:', msg, stack);
    (self as unknown as { postMessage(m: unknown): void }).postMessage({ type: 'worker-error', message: msg, stack });
  } catch { try { console.debug('[svgRasterWorker.impl] Error while reporting worker error'); } catch { /* swallow */ } }
});

self.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => {
  try {
    const reason = (e && (e.reason !== undefined)) ? e.reason : 'unknown rejection';
    const stack = (reason && (reason as unknown as { stack?: string }).stack) ? (reason as unknown as { stack?: string }).stack : String(reason);
    logger.error('[svgRasterWorker.impl] Unhandled rejection:', reason, stack);
    (self as unknown as { postMessage(m: unknown): void }).postMessage({ type: 'worker-error', message: String(reason), stack });
  } catch { try { console.debug('[svgRasterWorker.impl] Error while reporting unhandled rejection'); } catch { /* swallow */ } }
});

self.addEventListener('messageerror', (e: MessageEvent) => {
  try {
    logger.error('[svgRasterWorker.impl] Message error:', e);
    (self as unknown as { postMessage(m: unknown): void }).postMessage({ type: 'worker-messageerror', detail: String(e) });
  } catch { try { console.debug('[svgRasterWorker.impl] Error while reporting messageerror'); } catch { /* swallow */ } }
});

export {};

