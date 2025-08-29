// SVG Loader with change detection and caching
// Handles loading SVG files, detecting changes, and rasterizing to ImageBitmap

import type { GameState } from '../types/index.js';
import { getFileWatcher, watchSVGFiles, unwatchSVGFiles } from '../utils/fileWatcher.js';

export interface SVGAsset {
  url: string;
  svgText: string;
  lastModified: number;
  imageBitmap?: ImageBitmap;
}

export interface SVGLoadOptions {
  width?: number;
  height?: number;
  teamColor?: string;
  forceReload?: boolean;
  enableWatching?: boolean;
}

export class SVGLoader {
  private worker: Worker | null = null;
  private assets = new Map<string, SVGAsset>();
  private loadingPromises = new Map<string, Promise<SVGAsset>>();
  private watchedFiles = new Set<string>();

  constructor() {
    this.initWorker();
    this.setupFileWatching();
  }

  private initWorker() {
    // Temporarily disable worker to ensure reliable main thread SVG loading
    console.log('[SVGLoader] Using main thread SVG rasterization (worker disabled for stability)');
    this.worker = null;
  }

  private handleWorkerMessage(data: any) {
    // Handle worker responses if needed for advanced caching
    if (data.type === 'rasterized') {
      // Update asset with rasterized bitmap
      const asset = this.assets.get(data.assetKey);
      if (asset) {
        asset.imageBitmap = data.imageBitmap;
      }
    }
  }

  private setupFileWatching() {
    const fileWatcher = getFileWatcher();

    // Set up global change handler
    fileWatcher.watchMultiple([], (filePath, changeType) => {
      this.handleFileChange(filePath, changeType);
    });
  }

  private handleFileChange(filePath: string, changeType: 'modified' | 'deleted' | 'created') {
    console.log(`[SVGLoader] File ${changeType}: ${filePath}`);

    if (changeType === 'modified' || changeType === 'deleted') {
      // Invalidate cache for this file
      this.clearCache(filePath);

      // If file was deleted, stop watching it
      if (changeType === 'deleted') {
        this.unwatchFile(filePath);
      }
    }
    // For 'created', we don't need to do anything special here
    // The file will be loaded when requested
  }

  // Load SVG from URL with change detection
  async loadSVG(url: string, options: SVGLoadOptions = {}): Promise<SVGAsset> {
    const { forceReload = false, enableWatching = true } = options;

    // Start watching this file if not already watched
    if (enableWatching && !this.watchedFiles.has(url)) {
      this.watchFile(url);
    }

    // Check if already loading
    const existingPromise = this.loadingPromises.get(url);
    if (existingPromise && !forceReload) {
      return existingPromise;
    }

    // Check cache
    const cached = this.assets.get(url);
    if (cached && !forceReload) {
      // Check if file has changed
      const hasChanged = await this.hasFileChanged(url, cached.lastModified);
      if (!hasChanged) {
        return cached;
      }
    }

    // Start loading
    const loadPromise = this.performLoad(url, options);
    this.loadingPromises.set(url, loadPromise);

    try {
      const asset = await loadPromise;
      this.assets.set(url, asset);
      return asset;
    } finally {
      this.loadingPromises.delete(url);
    }
  }

  private async performLoad(url: string, options: SVGLoadOptions): Promise<SVGAsset> {
    console.log(`[SVGLoader] Attempting to load SVG from: ${url}`);
    
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`[SVGLoader] Failed to fetch SVG: ${response.status} ${response.statusText} for ${url}`);
      throw new Error(`Failed to load SVG: ${response.status} ${response.statusText}`);
    }

    const svgText = await response.text();
    console.log(`[SVGLoader] Successfully fetched SVG content for ${url}, length: ${svgText.length}`);
    
    const lastModified = await this.getFileModificationTime(url);

    const asset: SVGAsset = {
      url,
      svgText,
      lastModified
    };

    // Rasterize if dimensions provided
    if (options.width && options.height) {
      console.log('[SVGLoader] Starting rasterization for:', url);
      const imageBitmap = await this.rasterizeSVG(asset, options);
      asset.imageBitmap = imageBitmap;
      console.log('[SVGLoader] Rasterization completed for:', url);
    }

    return asset;
  }

  private async rasterizeSVG(asset: SVGAsset, options: SVGLoadOptions): Promise<ImageBitmap> {
    console.log('[SVGLoader] Rasterizing SVG with main thread (worker disabled):', asset.url);
    
    // Always use main thread rasterization for reliability
    return this.rasterizeMainThread(asset, options);
  }

  private async rasterizeWithWorker(asset: SVGAsset, options: SVGLoadOptions): Promise<ImageBitmap> {
    return new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(new Error('Worker not available'));
        return;
      }

      const messageId = Math.random().toString(36);

      const messageHandler = (e: MessageEvent) => {
        const data = e.data;
        if (data.type === 'rasterized' && data.assetKey === asset.url) {
          this.worker!.removeEventListener('message', messageHandler);
          resolve(data.imageBitmap);
        }
      };

      this.worker.addEventListener('message', messageHandler);

      // Send rasterization request
      this.worker.postMessage({
        type: 'rasterize',
        svgText: asset.svgText,
        width: options.width!,
        height: options.height!,
        assetKey: asset.url,
        teamColor: options.teamColor,
        filePath: asset.url,
        fileModTime: asset.lastModified
      });

      // Timeout after 8 seconds (increased timeout)
      setTimeout(() => {
        this.worker!.removeEventListener('message', messageHandler);
        reject(new Error('Rasterization timeout'));
      }, 8000);
    });
  }

  private async rasterizeMainThread(asset: SVGAsset, options: SVGLoadOptions): Promise<ImageBitmap> {
    // Use regular Canvas instead of OffscreenCanvas for better SVG compatibility
    const canvas = document.createElement('canvas');
    canvas.width = options.width!;
    canvas.height = options.height!;
    const ctx = canvas.getContext('2d')!;

    // Clear canvas
    ctx.clearRect(0, 0, options.width!, options.height!);

    try {
      console.log('[SVGLoader] Attempting to rasterize SVG in main thread for:', asset.url);
      
      // Create a properly formatted SVG data URL
      let svgContent = asset.svgText;
      
      // Ensure SVG has proper dimensions if missing
      if (!svgContent.includes('width=') || !svgContent.includes('height=')) {
        svgContent = svgContent.replace(
          /<svg([^>]*)>/,
          `<svg$1 width="${options.width}" height="${options.height}">`
        );
      }
      
      // Create data URL with proper encoding
      const svgDataUrl = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgContent)))}`;
      
      // Load SVG as image
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      await new Promise<void>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error('SVG image load timeout after 10 seconds'));
        }, 10000);
        
        img.onload = () => {
          clearTimeout(timeoutId);
          console.log('[SVGLoader] Successfully loaded SVG image:', asset.url);
          resolve();
        };
        
        img.onerror = (e) => {
          clearTimeout(timeoutId);
          console.error('[SVGLoader] Failed to load SVG image:', e);
          reject(new Error(`SVG image load failed`));
        };
        
        img.src = svgDataUrl;
      });

      // Draw the SVG image to canvas with proper scaling
      ctx.save();
      ctx.clearRect(0, 0, options.width!, options.height!);
      
      // Scale image to fit canvas
      const scale = Math.min(options.width! / img.width, options.height! / img.height);
      const scaledWidth = img.width * scale;
      const scaledHeight = img.height * scale;
      const offsetX = (options.width! - scaledWidth) / 2;
      const offsetY = (options.height! - scaledHeight) / 2;
      
      ctx.drawImage(img, offsetX, offsetY, scaledWidth, scaledHeight);
      ctx.restore();

      // Apply team color tinting if specified
      if (options.teamColor) {
        this.applyTeamColorTint(ctx, options.width!, options.height!, options.teamColor);
      }

      console.log('[SVGLoader] Successfully rasterized SVG to canvas:', asset.url);
      
      // Convert canvas to ImageBitmap
      return await createImageBitmap(canvas);
      
    } catch (error) {
      console.error('[SVGLoader] SVG rasterization failed completely:', error);
      
      // Return error - don't create geometric fallback here anymore
      // Let the renderer handle fallbacks appropriately
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to rasterize SVG ${asset.url}: ${errorMessage}`);
    }
  }

  // Apply team color tinting to the rasterized SVG
  private applyTeamColorTint(
    ctx: CanvasRenderingContext2D,
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

  // Check if file has changed since last load
  private async hasFileChanged(url: string, lastModified: number): Promise<boolean> {
    try {
      const currentModTime = await this.getFileModificationTime(url);
      return currentModTime > lastModified;
    } catch {
      // If we can't check modification time, assume no change
      return false;
    }
  }

  // Get file modification time
  // Note: In browser environment, we use a combination of approaches
  private async getFileModificationTime(url: string): Promise<number> {
    try {
      // Try to get from response headers
      const response = await fetch(url, {
        method: 'HEAD',
        cache: 'no-cache'
      });
      const lastModified = response.headers.get('last-modified');
      if (lastModified) {
        return new Date(lastModified).getTime();
      }
    } catch {
      // Ignore errors
    }

    // Fallback: use current time as modification time
    // In a real implementation, you might want to implement a more sophisticated
    // change detection mechanism, perhaps with ETags or content hashing
    return Date.now();
  }

  // Watch a specific file
  private watchFile(url: string): void {
    if (this.watchedFiles.has(url)) return;

    const fileWatcher = getFileWatcher();
    fileWatcher.watch(url, (filePath, changeType) => {
      this.handleFileChange(filePath, changeType);
    });

    this.watchedFiles.add(url);
  }

  // Stop watching a specific file
  private unwatchFile(url: string): void {
    if (!this.watchedFiles.has(url)) return;

    const fileWatcher = getFileWatcher();
    fileWatcher.unwatch(url);
    this.watchedFiles.delete(url);
  }

  // Clear cache for specific asset or all assets
  clearCache(assetUrl?: string) {
    if (assetUrl) {
      const asset = this.assets.get(assetUrl);
      if (asset && asset.imageBitmap) {
        asset.imageBitmap.close();
      }
      this.assets.delete(assetUrl);
    } else {
      // Clear all
      for (const asset of this.assets.values()) {
        if (asset.imageBitmap) {
          asset.imageBitmap.close();
        }
      }
      this.assets.clear();
    }

    // Notify worker to clear cache
    if (this.worker) {
      this.worker.postMessage({
        type: 'clear-cache'
      });
    }
  }

  // Force reload of all assets
  async reloadAllAssets(): Promise<void> {
    const urls = Array.from(this.assets.keys());
    await Promise.all(urls.map(url => this.loadSVG(url, { forceReload: true })));
  }

  // Get asset without loading
  getAsset(url: string): SVGAsset | undefined {
    return this.assets.get(url);
  }

  // Check if asset is cached
  hasAsset(url: string): boolean {
    return this.assets.has(url);
  }

  // Get cache statistics
  getCacheStats() {
    return {
      cachedAssets: this.assets.size,
      loadingPromises: this.loadingPromises.size,
      watchedFiles: this.watchedFiles.size
    };
  }

  // Cleanup resources
  dispose() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }

    // Stop watching all files
    const fileWatcher = getFileWatcher();
    this.watchedFiles.forEach(url => {
      fileWatcher.unwatch(url);
    });
    this.watchedFiles.clear();

    this.clearCache();
    this.loadingPromises.clear();
  }
}

// Global SVG loader instance
let globalSVGLoader: SVGLoader | null = null;

export function getSVGLoader(): SVGLoader {
  if (!globalSVGLoader) {
    globalSVGLoader = new SVGLoader();
  }
  return globalSVGLoader;
}

// Convenience function to load SVG asset
export async function loadSVGAsset(
  url: string,
  options: SVGLoadOptions = {}
): Promise<SVGAsset> {
  return getSVGLoader().loadSVG(url, options);
}

// Convenience function to load and rasterize SVG
export async function loadSVGBitmap(
  url: string,
  width: number,
  height: number,
  teamColor?: string
): Promise<ImageBitmap> {
  const asset = await loadSVGAsset(url, { width, height, teamColor });
  if (!asset.imageBitmap) {
    throw new Error(`Failed to rasterize SVG: ${url}`);
  }
  return asset.imageBitmap;
}