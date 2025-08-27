/**
 * Main thread interface for SVG rasterization worker
 * Provides async SVG to bitmap conversion with caching and IndexedDB persistence
 */

import { get, set, del, clear, keys } from 'idb-keyval';

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
  /** Use persistent IndexedDB cache */
  usePersistentCache?: boolean;
}

interface PendingRequest {
  resolve: (bitmap: ImageBitmap | null) => void;
  reject: (error: Error) => void;
  timestamp: number;
}

interface PersistentCacheEntry {
  bitmap: ArrayBuffer;
  width: number;
  height: number;
  timestamp: number;
  ttl: number;
  cacheKey: string;
}

/**
 * SVG Rasterization Manager - Main thread interface
 */
export class SVGRasterManager {
  private worker: Worker | null = null;
  private pendingRequests = new Map<string, PendingRequest>();
  private requestCounter = 0;
  private workerPath: string;
  private defaultOptions: Required<RasterizeOptions>;
  private isIndexedDBSupported: boolean;
  
  constructor(workerPath: string = '/workers/svgRasterWorker.js', defaultOptions?: Partial<RasterizeOptions>) {
    this.workerPath = workerPath;
    this.isIndexedDBSupported = this.checkIndexedDBSupport();
    
    this.defaultOptions = {
      backgroundColor: 'transparent',
      devicePixelRatio: window.devicePixelRatio || 1,
      quality: 'high',
      antialias: true,
      cacheTTL: 300000, // 5 minutes
      skipCache: false,
      usePersistentCache: true,
      ...defaultOptions
    };
    
    this.initializeWorker();
  }
  
  /**
   * Check if IndexedDB is supported
   */
  private checkIndexedDBSupport(): boolean {
    return typeof indexedDB !== 'undefined';
  }
  
  /**
   * Initialize the Web Worker
   */
  private async initializeWorker(): Promise<void> {
    try {
      this.worker = new Worker(this.workerPath, { type: 'module' });
      
      this.worker.onmessage = (event: MessageEvent<RasterizeResponse>) => {
        this.handleWorkerMessage(event.data);
      };
      
      this.worker.onerror = (error) => {
        console.error('SVG Raster Worker error:', error);
        this.rejectAllPending(new Error('Worker error'));
      };
      
      this.worker.onmessageerror = (error) => {
        console.error('SVG Raster Worker message error:', error);
        this.rejectAllPending(new Error('Worker message error'));
      };
      
    } catch (error) {
      console.warn('Failed to create SVG rasterization worker, falling back to main thread:', error);
      this.worker = null;
    }
  }
  
  /**
   * Handle worker response messages
   */
  private handleWorkerMessage(response: RasterizeResponse): void {
    const pending = this.pendingRequests.get(response.id);
    if (!pending) {
      console.warn('Received response for unknown request:', response.id);
      return;
    }
    
    this.pendingRequests.delete(response.id);
    
    if (response.type === 'rasterize:done') {
      // Store in persistent cache if enabled and available
      if (response.bitmap && response.cacheKey && this.defaultOptions.usePersistentCache) {
        this.storePersistentCache(response.cacheKey, response.bitmap, this.defaultOptions.cacheTTL)
          .catch(error => console.warn('Failed to store in persistent cache:', error));
      }
      
      pending.resolve(response.bitmap || null);
    } else if (response.type === 'rasterize:error') {
      pending.reject(new Error(response.error || 'Unknown rasterization error'));
    }
  }
  
  /**
   * Reject all pending requests
   */
  private rejectAllPending(error: Error): void {
    for (const [id, pending] of this.pendingRequests) {
      pending.reject(error);
    }
    this.pendingRequests.clear();
  }
  
  /**
   * Rasterize SVG to ImageBitmap
   */
  async rasterizeSvgToBitmap(
    svgText: string,
    width: number,
    height: number,
    options?: Partial<RasterizeOptions>
  ): Promise<ImageBitmap | null> {
    const finalOptions = { ...this.defaultOptions, ...options };
    
    // Generate cache key
    const cacheKey = this.generateCacheKey(svgText, width, height, finalOptions);
    
    // Check persistent cache first
    if (!finalOptions.skipCache && finalOptions.usePersistentCache && this.isIndexedDBSupported) {
      const cached = await this.getPersistentCache(cacheKey);
      if (cached) {
        return cached;
      }
    }
    
    // Use worker if available, otherwise fallback to main thread
    if (this.worker) {
      return this.rasterizeWithWorker(svgText, width, height, finalOptions);
    } else {
      return this.rasterizeMainThread(svgText, width, height, finalOptions);
    }
  }
  
  /**
   * Rasterize using Web Worker
   */
  private async rasterizeWithWorker(
    svgText: string,
    width: number,
    height: number,
    options: RasterizeOptions
  ): Promise<ImageBitmap | null> {
    if (!this.worker) {
      throw new Error('Worker not available');
    }
    
    const id = `raster_${++this.requestCounter}`;
    
    const request: RasterizeRequest = {
      type: 'rasterize',
      id,
      svgText,
      width,
      height,
      options
    };
    
    return new Promise<ImageBitmap | null>((resolve, reject) => {
      // Store pending request
      this.pendingRequests.set(id, {
        resolve,
        reject,
        timestamp: Date.now()
      });
      
      // Send to worker
      this.worker!.postMessage(request);
      
      // Timeout handling
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('Rasterization timeout'));
        }
      }, 30000); // 30 second timeout
    });
  }
  
  /**
   * Rasterize on main thread (fallback)
   */
  private async rasterizeMainThread(
    svgText: string,
    width: number,
    height: number,
    options: RasterizeOptions
  ): Promise<ImageBitmap | null> {
    try {
      const {
        backgroundColor = 'transparent',
        devicePixelRatio = 1,
        quality = 'high'
      } = options;
      
      // Calculate actual dimensions
      const actualWidth = Math.round(width * devicePixelRatio);
      const actualHeight = Math.round(height * devicePixelRatio);
      
      // Create SVG blob
      const svgBlob = new Blob([svgText], { type: 'image/svg+xml' });
      
      // Create ImageBitmap directly
      const bitmap = await createImageBitmap(svgBlob, {
        resizeWidth: actualWidth,
        resizeHeight: actualHeight,
        resizeQuality: quality as ResizeQuality
      });
      
      // Store in persistent cache if enabled
      if (options.usePersistentCache && this.isIndexedDBSupported) {
        const cacheKey = this.generateCacheKey(svgText, width, height, options);
        await this.storePersistentCache(cacheKey, bitmap, options.cacheTTL || 300000);
      }
      
      return bitmap;
      
    } catch (error) {
      console.error('Main thread rasterization failed:', error);
      return null;
    }
  }
  
  /**
   * Generate cache key
   */
  private generateCacheKey(
    svgText: string,
    width: number,
    height: number,
    options: RasterizeOptions
  ): string {
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
   * Simple hash function
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }
  
  /**
   * Store bitmap in persistent cache (IndexedDB)
   */
  private async storePersistentCache(
    cacheKey: string,
    bitmap: ImageBitmap,
    ttl: number
  ): Promise<void> {
    if (!this.isIndexedDBSupported) {
      return;
    }
    
    try {
      // Convert ImageBitmap to ArrayBuffer
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Failed to get 2D context');
      }
      
      ctx.drawImage(bitmap, 0, 0);
      
      // Get image data as ArrayBuffer
      const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
      const arrayBuffer = imageData.data.buffer.slice();
      
      const entry: PersistentCacheEntry = {
        bitmap: arrayBuffer,
        width: bitmap.width,
        height: bitmap.height,
        timestamp: Date.now(),
        ttl,
        cacheKey
      };
      
      await set(`svg_cache_${cacheKey}`, entry);
      
    } catch (error) {
      console.warn('Failed to store persistent cache:', error);
    }
  }
  
  /**
   * Retrieve bitmap from persistent cache
   */
  private async getPersistentCache(cacheKey: string): Promise<ImageBitmap | null> {
    if (!this.isIndexedDBSupported) {
      return null;
    }
    
    try {
      const entry: PersistentCacheEntry | undefined = await get(`svg_cache_${cacheKey}`);
      if (!entry) {
        return null;
      }
      
      // Check if expired
      const now = Date.now();
      if (now - entry.timestamp > entry.ttl) {
        await del(`svg_cache_${cacheKey}`);
        return null;
      }
      
      // Reconstruct ImageBitmap from ArrayBuffer
      const imageData = new ImageData(
        new Uint8ClampedArray(entry.bitmap),
        entry.width,
        entry.height
      );
      
      const canvas = document.createElement('canvas');
      canvas.width = entry.width;
      canvas.height = entry.height;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Failed to get 2D context');
      }
      
      ctx.putImageData(imageData, 0, 0);
      
      const bitmap = await createImageBitmap(canvas);
      return bitmap;
      
    } catch (error) {
      console.warn('Failed to retrieve persistent cache:', error);
      return null;
    }
  }
  
  /**
   * Clear persistent cache
   */
  async clearPersistentCache(): Promise<void> {
    if (!this.isIndexedDBSupported) {
      return;
    }
    
    try {
      const allKeys = await keys();
      const cacheKeys = allKeys.filter(key => 
        typeof key === 'string' && key.startsWith('svg_cache_')
      );
      
      for (const key of cacheKeys) {
        await del(key);
      }
      
      console.log(`Cleared ${cacheKeys.length} persistent cache entries`);
      
    } catch (error) {
      console.warn('Failed to clear persistent cache:', error);
    }
  }
  
  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    persistentEntries: number;
    estimatedSizeMB: number;
    workerCacheStats?: any;
  }> {
    const stats = {
      persistentEntries: 0,
      estimatedSizeMB: 0,
      workerCacheStats: undefined as any
    };
    
    if (this.isIndexedDBSupported) {
      try {
        const allKeys = await keys();
        const cacheKeys = allKeys.filter(key => 
          typeof key === 'string' && key.startsWith('svg_cache_')
        );
        
        stats.persistentEntries = cacheKeys.length;
        
        // Estimate size
        let totalSize = 0;
        for (const key of cacheKeys.slice(0, 10)) { // Sample first 10 for estimation
          const entry: PersistentCacheEntry | undefined = await get(key);
          if (entry) {
            totalSize += entry.bitmap.byteLength;
          }
        }
        
        // Extrapolate total size
        if (cacheKeys.length > 0) {
          const avgSize = totalSize / Math.min(10, cacheKeys.length);
          stats.estimatedSizeMB = (avgSize * cacheKeys.length) / (1024 * 1024);
        }
        
      } catch (error) {
        console.warn('Failed to get cache stats:', error);
      }
    }
    
    // Get worker cache stats if available
    if (this.worker) {
      try {
        // This would require implementing a request/response pattern for stats
        // For now, just mark as available
        stats.workerCacheStats = { available: true };
      } catch (error) {
        console.warn('Failed to get worker cache stats:', error);
      }
    }
    
    return stats;
  }
  
  /**
   * Dispose of the manager and clean up resources
   */
  dispose(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    
    this.rejectAllPending(new Error('SVGRasterManager disposed'));
  }
}

/**
 * Global instance for easy access
 */
let globalRasterManager: SVGRasterManager | null = null;

/**
 * Get or create global SVG raster manager
 */
export function getSVGRasterManager(workerPath?: string, options?: Partial<RasterizeOptions>): SVGRasterManager {
  if (!globalRasterManager) {
    globalRasterManager = new SVGRasterManager(workerPath, options);
  }
  return globalRasterManager;
}

/**
 * Utility function for quick SVG rasterization
 */
export async function rasterizeSVG(
  svgText: string,
  width: number,
  height: number,
  options?: Partial<RasterizeOptions>
): Promise<ImageBitmap | null> {
  const manager = getSVGRasterManager();
  return manager.rasterizeSvgToBitmap(svgText, width, height, options);
}