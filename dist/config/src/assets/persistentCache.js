/**
 * Persistent SVG Rasterization Cache
 *
 * Uses IndexedDB to persistently cache rasterized SVG bitmaps across browser sessions.
 * Includes TTL, versioning, and size limits to manage storage efficiently.
 */
import { get, set, del, keys } from 'idb-keyval';
const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const DEFAULT_MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50MB
const DEFAULT_VERSION = '1.0';
/**
 * Persistent cache for rasterized SVG bitmaps
 */
export class PersistentSVGCache {
    options;
    cachePrefix = 'svg_raster_';
    metaKey = 'svg_cache_meta';
    constructor(options = {}) {
        this.options = {
            ttlMs: options.ttlMs || DEFAULT_TTL_MS,
            maxSizeBytes: options.maxSizeBytes || DEFAULT_MAX_SIZE_BYTES,
            version: options.version || DEFAULT_VERSION
        };
    }
    /**
     * Generate cache key from SVG content and parameters
     */
    generateKey(svgText, width, height, teamColor) {
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
    async getCachedBitmap(svgText, width, height, teamColor) {
        try {
            const key = this.generateKey(svgText, width, height, teamColor);
            const entry = await get(key);
            if (!entry)
                return null;
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
        }
        catch (error) {
            console.warn('Failed to retrieve cached bitmap:', error);
            return null;
        }
    }
    /**
     * Cache a bitmap with metadata
     */
    async cacheBitmap(svgText, width, height, bitmap, teamColor) {
        try {
            const key = this.generateKey(svgText, width, height, teamColor);
            // Convert ImageBitmap to Blob for storage
            const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
            const ctx = canvas.getContext('2d');
            if (!ctx)
                return;
            ctx.drawImage(bitmap, 0, 0);
            const blob = await canvas.convertToBlob();
            const entry = {
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
        }
        catch (error) {
            console.warn('Failed to cache bitmap:', error);
        }
    }
    /**
     * Ensure cache doesn't exceed size limit by evicting old entries
     */
    async ensureCacheSize(newEntrySize) {
        try {
            const allKeys = await keys();
            const cacheKeys = allKeys.filter((key) => typeof key === 'string' && key.startsWith(this.cachePrefix));
            if (cacheKeys.length === 0)
                return;
            // Get all entries with timestamps
            const entries = [];
            let totalSize = newEntrySize;
            for (const key of cacheKeys) {
                try {
                    const entry = await get(key);
                    if (entry) {
                        entries.push({ key: key, entry });
                        totalSize += entry.sizeBytes;
                    }
                }
                catch {
                    // Skip invalid entries
                }
            }
            // If under limit, no need to evict
            if (totalSize <= this.options.maxSizeBytes)
                return;
            // Sort by timestamp (oldest first)
            entries.sort((a, b) => a.entry.timestamp - b.entry.timestamp);
            // Evict oldest entries until under limit
            for (const { key, entry } of entries) {
                if (totalSize <= this.options.maxSizeBytes)
                    break;
                await del(key);
                totalSize -= entry.sizeBytes;
            }
        }
        catch (error) {
            console.warn('Failed to ensure cache size:', error);
        }
    }
    /**
     * Update cache metadata
     */
    async updateCacheMeta() {
        try {
            const meta = {
                lastUpdated: Date.now(),
                version: this.options.version
            };
            await set(this.metaKey, meta);
        }
        catch (error) {
            console.warn('Failed to update cache meta:', error);
        }
    }
    /**
     * Clear expired entries
     */
    async clearExpired() {
        let clearedCount = 0;
        try {
            const allKeys = await keys();
            const cacheKeys = allKeys.filter((key) => typeof key === 'string' && key.startsWith(this.cachePrefix));
            const now = Date.now();
            for (const key of cacheKeys) {
                try {
                    const entry = await get(key);
                    if (entry && (now - entry.timestamp > this.options.ttlMs)) {
                        await del(key);
                        clearedCount++;
                    }
                }
                catch {
                    // Skip invalid entries
                }
            }
        }
        catch (error) {
            console.warn('Failed to clear expired entries:', error);
        }
        return clearedCount;
    }
    /**
     * Clear all cache entries
     */
    async clearAll() {
        try {
            const allKeys = await keys();
            const cacheKeys = allKeys.filter((key) => typeof key === 'string' && (key.startsWith(this.cachePrefix) || key === this.metaKey));
            for (const key of cacheKeys) {
                await del(key);
            }
        }
        catch (error) {
            console.warn('Failed to clear cache:', error);
        }
    }
    /**
     * Get cache statistics
     */
    async getCacheStats() {
        try {
            const allKeys = await keys();
            const cacheKeys = allKeys.filter((key) => typeof key === 'string' && key.startsWith(this.cachePrefix));
            let totalSize = 0;
            let oldestTimestamp = null;
            let newestTimestamp = null;
            for (const key of cacheKeys) {
                try {
                    const entry = await get(key);
                    if (entry) {
                        totalSize += entry.sizeBytes;
                        if (oldestTimestamp === null || entry.timestamp < oldestTimestamp) {
                            oldestTimestamp = entry.timestamp;
                        }
                        if (newestTimestamp === null || entry.timestamp > newestTimestamp) {
                            newestTimestamp = entry.timestamp;
                        }
                    }
                }
                catch {
                    // Skip invalid entries
                }
            }
            return {
                entryCount: cacheKeys.length,
                totalSizeBytes: totalSize,
                oldestEntry: oldestTimestamp,
                newestEntry: newestTimestamp
            };
        }
        catch (error) {
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
let globalCache = null;
/**
 * Get the global persistent cache instance
 */
export function getPersistentSVGCache(options) {
    if (!globalCache) {
        globalCache = new PersistentSVGCache(options);
    }
    return globalCache;
}
