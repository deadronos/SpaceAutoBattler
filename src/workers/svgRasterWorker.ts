/**
 * OffscreenCanvas-based SVG rasterization worker
 * Provides async SVG to bitmap conversion with caching and optimization
 */

export interface RasterizeRequest {
  type: 'rasterize';
  id: string;
  svgText: string;
  width: number;
  height: number;
  options?: RasterizeOptions;
}

export interface RasterizeResponse {
  type: 'rasterize:done' | 'rasterize:error';
  id: string;
  bitmap?: ImageBitmap;
  error?: string;
  cacheKey?: string;
}

export interface RasterizeOptions {
  /** Background color (default: transparent) */
  backgroundColor?: string;
  /** Scale factor for high-DPI displays */
  devicePixelRatio?: number;
  /** Quality setting for rasterization */
  quality?: 'low' | 'medium' | 'high';
  /** Whether to enable antialiasing */
  antialias?: boolean;
  /** Cache TTL in milliseconds */
  cacheTTL?: number;
  /** Force re-rasterization even if cached */
  skipCache?: boolean;
}

interface CacheEntry {
  bitmap: ImageBitmap;
  timestamp: number;
  ttl: number;
  cacheKey: string;
}

/**
 * SVG Rasterization Worker - runs in Web Worker context
 */
class SVGRasterWorker {
  private cache = new Map<string, CacheEntry>();
  private offscreenCanvas: OffscreenCanvas | null = null;
  private ctx: OffscreenCanvasRenderingContext2D | null = null;
  private isOffscreenCanvasSupported: boolean;
  
  constructor() {
    this.isOffscreenCanvasSupported = typeof OffscreenCanvas !== 'undefined';
    
    // Initialize OffscreenCanvas if supported
    if (this.isOffscreenCanvasSupported) {
      this.offscreenCanvas = new OffscreenCanvas(1, 1);
      this.ctx = this.offscreenCanvas.getContext('2d');
    }
    
    // Periodic cache cleanup
    setInterval(() => this.cleanupCache(), 60000); // Every minute
  }
  
  /**
   * Process rasterization request
   */
  async processRequest(request: RasterizeRequest): Promise<RasterizeResponse> {
    try {
      const { id, svgText, width, height, options = {} } = request;
      
      // Generate cache key
      const cacheKey = this.generateCacheKey(svgText, width, height, options);
      
      // Check cache first (unless skip cache is requested)
      if (!options.skipCache) {
        const cached = this.getCachedBitmap(cacheKey);
        if (cached) {
          return {
            type: 'rasterize:done',
            id,
            bitmap: cached,
            cacheKey
          };
        }
      }
      
      // Rasterize SVG
      const bitmap = await this.rasterizeSVG(svgText, width, height, options);
      
      // Cache result
      if (bitmap) {
        this.cacheBitmap(cacheKey, bitmap, options.cacheTTL || 300000); // 5 minutes default
      }
      
      return {
        type: 'rasterize:done',
        id,
        bitmap: bitmap || undefined,
        cacheKey
      };
      
    } catch (error) {
      return {
        type: 'rasterize:error',
        id: request.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * Rasterize SVG to ImageBitmap
   */
  private async rasterizeSVG(
    svgText: string,
    width: number,
    height: number,
    options: RasterizeOptions
  ): Promise<ImageBitmap | null> {
    const {
      backgroundColor = 'transparent',
      devicePixelRatio = 1,
      quality = 'high',
      antialias = true
    } = options;
    
    // Calculate actual dimensions
    const actualWidth = Math.round(width * devicePixelRatio);
    const actualHeight = Math.round(height * devicePixelRatio);
    
    if (this.isOffscreenCanvasSupported && this.offscreenCanvas && this.ctx) {
      return this.rasterizeWithOffscreenCanvas(
        svgText, actualWidth, actualHeight, backgroundColor, quality, antialias
      );
    } else {
      // Fallback to main thread (this wouldn't actually work in a worker,
      // but shows the pattern for main-thread fallback)
      return this.rasterizeWithDataURL(svgText, actualWidth, actualHeight, backgroundColor);
    }
  }
  
  /**
   * Rasterize using OffscreenCanvas (worker-compatible)
   */
  private async rasterizeWithOffscreenCanvas(
    svgText: string,
    width: number,
    height: number,
    backgroundColor: string,
    quality: string,
    antialias: boolean
  ): Promise<ImageBitmap | null> {
    if (!this.offscreenCanvas || !this.ctx) {
      throw new Error('OffscreenCanvas not available');
    }
    
    // Resize canvas
    this.offscreenCanvas.width = width;
    this.offscreenCanvas.height = height;
    
    // Configure context
    this.ctx.imageSmoothingEnabled = antialias;
    this.ctx.imageSmoothingQuality = quality as ImageSmoothingQuality;
    
    // Clear canvas with background
    if (backgroundColor !== 'transparent') {
      this.ctx.fillStyle = backgroundColor;
      this.ctx.fillRect(0, 0, width, height);
    } else {
      this.ctx.clearRect(0, 0, width, height);
    }
    
    // Create SVG image
    const svgBlob = new Blob([svgText], { type: 'image/svg+xml' });
    const svgUrl = URL.createObjectURL(svgBlob);
    
    try {
      // Create image from SVG
      const img = await this.createImageFromURL(svgUrl);
      
      // Draw to canvas
      this.ctx.drawImage(img, 0, 0, width, height);
      
      // Create ImageBitmap
      const bitmap = this.offscreenCanvas.transferToImageBitmap();
      
      return bitmap;
      
    } finally {
      URL.revokeObjectURL(svgUrl);
    }
  }
  
  /**
   * Fallback rasterization using data URL (for main thread)
   */
  private async rasterizeWithDataURL(
    svgText: string,
    width: number,
    height: number,
    backgroundColor: string
  ): Promise<ImageBitmap | null> {
    // Create data URL
    const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}`;
    
    try {
      // Use createImageBitmap directly (available in workers)
      const response = await fetch(svgDataUrl);
      const blob = await response.blob();
      
      const bitmap = await createImageBitmap(blob, {
        resizeWidth: width,
        resizeHeight: height,
        resizeQuality: 'high'
      });
      
      return bitmap;
      
    } catch (error) {
      console.warn('Failed to create ImageBitmap from data URL:', error);
      return null;
    }
  }
  
  /**
   * Create image from URL (Promise-based)
   */
  private createImageFromURL(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load SVG image'));
      img.src = url;
    });
  }
  
  /**
   * Generate cache key for SVG + options
   */
  private generateCacheKey(
    svgText: string,
    width: number,
    height: number,
    options: RasterizeOptions
  ): string {
    // Create a simple hash of the inputs
    const input = JSON.stringify({
      svgText: svgText.substring(0, 1000), // First 1KB for efficiency
      width,
      height,
      backgroundColor: options.backgroundColor,
      devicePixelRatio: options.devicePixelRatio,
      quality: options.quality,
      antialias: options.antialias
    });
    
    return this.simpleHash(input);
  }
  
  /**
   * Simple hash function for cache keys
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }
  
  /**
   * Get cached bitmap if valid
   */
  private getCachedBitmap(cacheKey: string): ImageBitmap | null {
    const entry = this.cache.get(cacheKey);
    if (!entry) {
      return null;
    }
    
    // Check if expired
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(cacheKey);
      entry.bitmap.close(); // Free memory
      return null;
    }
    
    return entry.bitmap;
  }
  
  /**
   * Cache bitmap with TTL
   */
  private cacheBitmap(cacheKey: string, bitmap: ImageBitmap, ttl: number): void {
    // Remove existing entry if present
    const existing = this.cache.get(cacheKey);
    if (existing) {
      existing.bitmap.close();
    }
    
    // Add new entry
    this.cache.set(cacheKey, {
      bitmap,
      timestamp: Date.now(),
      ttl,
      cacheKey
    });
  }
  
  /**
   * Clean up expired cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    const toDelete: string[] = [];
    
    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp > entry.ttl) {
        toDelete.push(key);
        entry.bitmap.close(); // Free memory
      }
    }
    
    for (const key of toDelete) {
      this.cache.delete(key);
    }
    
    if (toDelete.length > 0) {
      console.log(`Cleaned up ${toDelete.length} expired cache entries`);
    }
  }
  
  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; memoryEstimateMB: number; entries: Array<{key: string; age: number}> } {
    const now = Date.now();
    const entries: Array<{key: string; age: number}> = [];
    let memoryEstimate = 0;
    
    for (const [key, entry] of this.cache) {
      entries.push({
        key,
        age: now - entry.timestamp
      });
      
      // Rough memory estimate (width * height * 4 bytes per pixel)
      memoryEstimate += entry.bitmap.width * entry.bitmap.height * 4;
    }
    
    return {
      size: this.cache.size,
      memoryEstimateMB: memoryEstimate / (1024 * 1024),
      entries: entries.sort((a, b) => b.age - a.age) // Sort by age, oldest first
    };
  }
  
  /**
   * Clear all cached bitmaps
   */
  clearCache(): void {
    for (const [key, entry] of this.cache) {
      entry.bitmap.close();
    }
    this.cache.clear();
  }
}

// Worker message handling
declare const self: any;

if (typeof self !== 'undefined' && 'importScripts' in self) {
  // We're in a Web Worker context
  const worker = new SVGRasterWorker();
  
  self.onmessage = async (event: MessageEvent<RasterizeRequest>) => {
    const request = event.data;
    
    if (request.type === 'rasterize') {
      const response = await worker.processRequest(request);
      
      // Transfer ImageBitmap if present
      if (response.bitmap) {
        self.postMessage(response, [response.bitmap]);
      } else {
        self.postMessage(response);
      }
    }
  };
  
  // Handle cache-related messages
  self.addEventListener('message', (event: any) => {
    const { data } = event;
    
    if (data.type === 'cache:stats') {
      const stats = worker.getCacheStats();
      self.postMessage({ type: 'cache:stats:response', stats });
    } else if (data.type === 'cache:clear') {
      worker.clearCache();
      self.postMessage({ type: 'cache:clear:response' });
    }
  });
}