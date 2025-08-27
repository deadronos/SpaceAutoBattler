/**
 * Persistent SVG Rasterization Cache
 * 
 * Uses IndexedDB to persistently cache rasterized SVG bitmaps across browser sessions.
 * Includes TTL, versioning, and size limits to manage storage efficiently.
 */

import { get, set, del, clear, keys } from 'idb-keyval';

export interface CacheEntry {
  version: string;
  timestamp: number;
  width: number;
  height: number;
  teamColor?: string;
  blob: Blob; // Store as blob for persistence
  sizeBytes: number;
}

export interface CacheOptions {
  ttlMs?: number; // Time to live in milliseconds
  maxSizeBytes?: number; // Maximum total cache size
  version?: string; // Cache version for invalidation
}

const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const DEFAULT_MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50MB
const DEFAULT_VERSION = '1.0';

/**
 * Persistent cache for rasterized SVG bitmaps
 */
export class PersistentSVGCache {
  private options: Required<CacheOptions>;
  private cachePrefix = 'svg_raster_';
  private metaKey = 'svg_cache_meta';

  constructor(options: CacheOptions = {}) {
    this.options = {
      ttlMs: options.ttlMs || DEFAULT_TTL_MS,
      maxSizeBytes: options.maxSizeBytes || DEFAULT_MAX_SIZE_BYTES,
      version: options.version || DEFAULT_VERSION
    };
  }

  /**
   * Generate cache key from SVG content and parameters
   */
  private generateKey(svgText: string, width: number, height: number, teamColor?: string): string {
    // Simple hash for cache key - in production could use crypto.subtle.digest
    const content = `${svgText}:${width}:${height}:${teamColor || ''}`;
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `${this.cachePrefix}${Math.abs(hash).toString(36)}`;
  }

  /**
   * Get cached bitmap if available and not expired
   */
  async getCachedBitmap(
    svgText: string,
    width: number,
    height: number,
    teamColor?: string
  ): Promise<ImageBitmap | null> {
    try {
      const key = this.generateKey(svgText, width, height, teamColor);
      const entry = await get(key) as CacheEntry | undefined;
      
      if (!entry) return null;
      
      // Check version
      if (entry.version !== this.options.version) {
        await del(key);
        return null;
      }
      
      // Check TTL
      const now = Date.now();
      if (now - entry.timestamp > this.options.ttlMs) {
        await del(key);
        return null;
      }
      
      // Verify dimensions match
      if (entry.width !== width || entry.height !== height) {
        return null;
      }
      
      // Convert blob back to ImageBitmap
      if (typeof createImageBitmap !== 'undefined') {
        return await createImageBitmap(entry.blob);
      }
      
      return null;
    } catch (error) {
      console.warn('Failed to retrieve cached bitmap:', error);
      return null;
    }
  }

  /**
   * Cache a bitmap with metadata
   */
  async cacheBitmap(
    svgText: string,
    width: number,
    height: number,
    bitmap: ImageBitmap,
    teamColor?: string
  ): Promise<void> {
    try {
      const key = this.generateKey(svgText, width, height, teamColor);
      
      // Convert ImageBitmap to Blob for storage
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      ctx.drawImage(bitmap, 0, 0);
      const blob = await canvas.convertToBlob();
      
      const entry: CacheEntry = {
        version: this.options.version,
        timestamp: Date.now(),
        width,
        height,
        teamColor,
        blob,
        sizeBytes: blob.size
      };
      
      // Check if we need to evict old entries
      await this.ensureCacheSize(entry.sizeBytes);
      
      // Store the entry
      await set(key, entry);
      
      // Update metadata
      await this.updateCacheMeta();
      
    } catch (error) {
      console.warn('Failed to cache bitmap:', error);
    }
  }

  /**
   * Ensure cache doesn't exceed size limit by evicting old entries
   */
  private async ensureCacheSize(newEntrySize: number): Promise<void> {
    try {
      const allKeys = await keys();
      const cacheKeys = allKeys.filter((key: any) => 
        typeof key === 'string' && key.startsWith(this.cachePrefix)
      );
      
      if (cacheKeys.length === 0) return;
      
      // Get all entries with timestamps
      const entries: Array<{ key: string; entry: CacheEntry }> = [];
      let totalSize = newEntrySize;
      
      for (const key of cacheKeys) {
        try {
          const entry = await get(key) as CacheEntry | undefined;
          if (entry) {
            entries.push({ key: key as string, entry });
            totalSize += entry.sizeBytes;
          }
        } catch {
          // Skip invalid entries
        }
      }
      
      // If under limit, no need to evict
      if (totalSize <= this.options.maxSizeBytes) return;
      
      // Sort by timestamp (oldest first)
      entries.sort((a, b) => a.entry.timestamp - b.entry.timestamp);
      
      // Evict oldest entries until under limit
      for (const { key, entry } of entries) {
        if (totalSize <= this.options.maxSizeBytes) break;
        
        await del(key);
        totalSize -= entry.sizeBytes;
      }
    } catch (error) {
      console.warn('Failed to ensure cache size:', error);
    }
  }

  /**
   * Update cache metadata
   */
  private async updateCacheMeta(): Promise<void> {
    try {
      const meta = {
        lastUpdated: Date.now(),
        version: this.options.version
      };
      await set(this.metaKey, meta);
    } catch (error) {
      console.warn('Failed to update cache meta:', error);
    }
  }

  /**
   * Clear expired entries
   */
  async clearExpired(): Promise<number> {
    let clearedCount = 0;
    
    try {
      const allKeys = await keys();
      const cacheKeys = allKeys.filter((key: any) => 
        typeof key === 'string' && key.startsWith(this.cachePrefix)
      );
      
      const now = Date.now();
      
      for (const key of cacheKeys) {
        try {
          const entry = await get(key) as CacheEntry | undefined;
          if (entry && (now - entry.timestamp > this.options.ttlMs)) {
            await del(key);
            clearedCount++;
          }
        } catch {
          // Skip invalid entries
        }
      }
    } catch (error) {
      console.warn('Failed to clear expired entries:', error);
    }
    
    return clearedCount;
  }

  /**
   * Clear all cache entries
   */
  async clearAll(): Promise<void> {
    try {
      const allKeys = await keys();
      const cacheKeys = allKeys.filter((key: any) => 
        typeof key === 'string' && (
          key.startsWith(this.cachePrefix) || key === this.metaKey
        )
      );
      
      for (const key of cacheKeys) {
        await del(key);
      }
    } catch (error) {
      console.warn('Failed to clear cache:', error);
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    entryCount: number;
    totalSizeBytes: number;
    oldestEntry: number | null;
    newestEntry: number | null;
  }> {
    try {
      const allKeys = await keys();
      const cacheKeys = allKeys.filter((key: any) => 
        typeof key === 'string' && key.startsWith(this.cachePrefix)
      );
      
      let totalSize = 0;
      let oldestTimestamp: number | null = null;
      let newestTimestamp: number | null = null;
      
      for (const key of cacheKeys) {
        try {
          const entry = await get(key) as CacheEntry | undefined;
          if (entry) {
            totalSize += entry.sizeBytes;
            
            if (oldestTimestamp === null || entry.timestamp < oldestTimestamp) {
              oldestTimestamp = entry.timestamp;
            }
            if (newestTimestamp === null || entry.timestamp > newestTimestamp) {
              newestTimestamp = entry.timestamp;
            }
          }
        } catch {
          // Skip invalid entries
        }
      }
      
      return {
        entryCount: cacheKeys.length,
        totalSizeBytes: totalSize,
        oldestEntry: oldestTimestamp,
        newestEntry: newestTimestamp
      };
    } catch (error) {
      console.warn('Failed to get cache stats:', error);
      return {
        entryCount: 0,
        totalSizeBytes: 0,
        oldestEntry: null,
        newestEntry: null
      };
    }
  }
}

// Global cache instance
let globalCache: PersistentSVGCache | null = null;

/**
 * Get the global persistent cache instance
 */
export function getPersistentSVGCache(options?: CacheOptions): PersistentSVGCache {
  if (!globalCache) {
    globalCache = new PersistentSVGCache(options);
  }
  return globalCache;
}