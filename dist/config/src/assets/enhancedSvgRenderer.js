/**
 * Enhanced SVG Renderer Integration
 *
 * Integrates the new OffscreenCanvas worker and persistent caching with the existing
 * SVG renderer to provide a seamless upgrade path with fallbacks.
 */
import { rasterizeSvgToBitmap, getSVGRasterizer } from './svgRaster';
import { getPersistentSVGCache } from './persistentCache';
/**
 * Enhanced SVG rasterization with worker, cache, and atlas support
 *
 * This is a drop-in replacement for existing SVG rasterization that adds:
 * - OffscreenCanvas worker background processing
 * - Persistent caching with TTL
 * - Texture atlas integration for efficient rendering
 * - Fallbacks for compatibility
 */
export async function enhancedRasterizeSvgWithTeamColors(svgText, teamColors, options = {}) {
    const size = options.size || 128;
    const teamColor = teamColors.hull;
    // If atlas is requested and available, add to atlas and return canvas
    if (options.useAtlas && options.atlasManager && options.assetKey) {
        try {
            const atlasEntry = await addSvgToAtlas(svgText, teamColors, options.atlasManager, options.assetKey, size);
            if (atlasEntry) {
                // Return a canvas representation for compatibility
                return createCanvasFromAtlasEntry(atlasEntry, options.atlasManager);
            }
        }
        catch (error) {
            console.warn('Atlas integration failed, falling back to direct rasterization:', error);
        }
    }
    // Continue with regular rasterization
    return enhancedRasterizeSvgWithoutAtlas(svgText, teamColors, {
        teamColor,
        useWorker: options.useWorker,
        useCache: options.useCache,
        size
    });
}
/**
 * Basic canvas rasterization fallback
 */
async function basicCanvasRasterization(svgText, teamColors, size) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error('Failed to get 2D context');
    }
    // Apply team colors to SVG
    let processedSvg = svgText;
    if (teamColors.hull) {
        processedSvg = processedSvg.replace(/id="hull"[^>]*>/g, (match) => match.replace(/fill="[^"]*"/, `fill="${teamColors.hull}"`));
    }
    if (teamColors.accent) {
        processedSvg = processedSvg.replace(/id="accent"[^>]*>/g, (match) => match.replace(/fill="[^"]*"/, `fill="${teamColors.accent}"`));
    }
    // Create blob URL and load
    const svgBlob = new Blob([processedSvg], { type: 'image/svg+xml' });
    const svgUrl = URL.createObjectURL(svgBlob);
    try {
        const img = await new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => resolve(image);
            image.onerror = () => reject(new Error('Failed to load SVG'));
            image.src = svgUrl;
        });
        ctx.drawImage(img, 0, 0, size, size);
        return canvas;
    }
    finally {
        URL.revokeObjectURL(svgUrl);
    }
}
/**
 * Convenience function to get cache statistics
 */
export async function getCacheStatistics() {
    try {
        const cache = getPersistentSVGCache();
        return await cache.getCacheStats();
    }
    catch (error) {
        console.warn('Failed to get cache statistics:', error);
        return {
            entryCount: 0,
            totalSizeBytes: 0,
            oldestEntry: null,
            newestEntry: null
        };
    }
}
/**
 * Clear expired cache entries
 */
export async function clearExpiredCache() {
    try {
        const cache = getPersistentSVGCache();
        return await cache.clearExpired();
    }
    catch (error) {
        console.warn('Failed to clear expired cache:', error);
        return 0;
    }
}
/**
 * Add SVG to texture atlas with team color support
 */
async function addSvgToAtlas(svgText, teamColors, atlasManager, assetKey, size) {
    const atlas = atlasManager.getAtlas('main');
    const cacheKey = `${assetKey}_${teamColors.hull || 'default'}_${size}`;
    // Check if already in atlas
    let entry = atlas.getEntry(cacheKey);
    if (entry) {
        return entry;
    }
    // Rasterize SVG with team colors
    const canvas = await enhancedRasterizeSvgWithoutAtlas(svgText, teamColors, { size });
    // Add to atlas
    entry = atlas.addEntry(cacheKey, canvas, size, size);
    return entry;
}
/**
 * Enhanced rasterization without atlas (internal helper)
 */
async function enhancedRasterizeSvgWithoutAtlas(svgText, teamColors, options) {
    const size = options.size || 128;
    const teamColor = teamColors.hull;
    // Try cache first if enabled
    if (options.useCache !== false) {
        try {
            const cache = getPersistentSVGCache();
            const cached = await cache.getCachedBitmap(svgText, size, size, teamColor);
            if (cached) {
                // Convert cached ImageBitmap to canvas
                const canvas = document.createElement('canvas');
                canvas.width = size;
                canvas.height = size;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(cached, 0, 0);
                    cached.close(); // Clean up ImageBitmap
                    return canvas;
                }
            }
        }
        catch (error) {
            console.warn('Cache lookup failed:', error);
        }
    }
    // Try enhanced rasterization with worker
    if (options.useWorker !== false) {
        try {
            const rasterizer = getSVGRasterizer();
            if (rasterizer.isWorkerAvailable()) {
                const bitmap = await rasterizeSvgToBitmap(svgText, size, size, {
                    teamColor,
                    useWorker: true
                });
                // Convert to canvas
                const canvas = document.createElement('canvas');
                canvas.width = size;
                canvas.height = size;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(bitmap, 0, 0);
                    // Cache the result if enabled
                    if (options.useCache !== false) {
                        try {
                            const cache = getPersistentSVGCache();
                            await cache.cacheBitmap(svgText, size, size, bitmap, teamColor);
                        }
                        catch (error) {
                            console.warn('Failed to cache bitmap:', error);
                        }
                    }
                    bitmap.close(); // Clean up ImageBitmap
                    return canvas;
                }
            }
        }
        catch (error) {
            console.warn('Worker rasterization failed, falling back to main thread:', error);
        }
    }
    // Fallback to enhanced main-thread rasterization
    try {
        const bitmap = await rasterizeSvgToBitmap(svgText, size, size, {
            teamColor,
            useWorker: false
        });
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.drawImage(bitmap, 0, 0);
            // Cache the result if enabled
            if (options.useCache !== false) {
                try {
                    const cache = getPersistentSVGCache();
                    await cache.cacheBitmap(svgText, size, size, bitmap, teamColor);
                }
                catch (error) {
                    console.warn('Failed to cache bitmap:', error);
                }
            }
            if ('close' in bitmap && typeof bitmap.close === 'function') {
                bitmap.close(); // Clean up ImageBitmap if available
            }
            return canvas;
        }
    }
    catch (error) {
        console.warn('Enhanced rasterization failed, using basic fallback:', error);
    }
    // Ultimate fallback - basic canvas rasterization
    return basicCanvasRasterization(svgText, teamColors, size);
}
/**
 * Create a canvas representation from atlas entry (for compatibility)
 */
function createCanvasFromAtlasEntry(entry, atlasManager) {
    const atlas = atlasManager.getAtlas('main');
    const atlasTexture = atlas.getTexture();
    // For now, return a placeholder canvas with entry metadata
    // In a real implementation, you'd extract the specific region from the atlas
    const canvas = document.createElement('canvas');
    canvas.width = entry.originalWidth;
    canvas.height = entry.originalHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
        // Draw placeholder that indicates this is atlas-backed
        ctx.fillStyle = '#4a4a4a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ffffff';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Atlas', canvas.width / 2, canvas.height / 2 - 5);
        ctx.fillText(entry.key, canvas.width / 2, canvas.height / 2 + 8);
        // Store atlas metadata on canvas for instanced rendering
        canvas.atlasEntry = entry;
        canvas.isAtlasBacked = true;
    }
    return canvas;
}
/**
 * Get atlas entry from a canvas if it's atlas-backed
 */
export function getAtlasEntryFromCanvas(canvas) {
    return canvas.atlasEntry || null;
}
/**
 * Check if a canvas is atlas-backed
 */
export function isAtlasBacked(canvas) {
    return !!canvas.isAtlasBacked;
}
/**
 * Batch process multiple SVGs into atlas
 */
export async function batchAddSvgsToAtlas(svgEntries, atlasManager) {
    const results = [];
    // Process in parallel but with some batching to avoid overwhelming
    const batchSize = 5;
    for (let i = 0; i < svgEntries.length; i += batchSize) {
        const batch = svgEntries.slice(i, i + batchSize);
        const batchResults = await Promise.all(batch.map(entry => addSvgToAtlas(entry.svgText, entry.teamColors, atlasManager, entry.assetKey, entry.size || 128)));
        results.push(...batchResults);
    }
    return results;
}
