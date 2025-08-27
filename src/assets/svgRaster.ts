/**
 * Main-thread SVG Rasterization Helper
 * 
 * Provides a clean interface for rasterizing SVG to ImageBitmap with worker-based
 * background processing and fallback to main-thread processing when needed.
 */

import type { RasterRequest, RasterResponse } from './svgRasterWorker';

export interface SVGRasterOptions {
  teamColor?: string;
  backgroundColor?: string;
  scale?: number;
  useWorker?: boolean; // Allow forcing main-thread fallback
}

export interface CacheEntry {
  bitmap: ImageBitmap;
  timestamp: number;
  size: number;
}

/**
 * Main SVG rasterization manager
 */
export class SVGRasterizer {
  private worker: Worker | null = null;
  private workerAvailable = false;
  private pendingRequests = new Map<string, {
    resolve: (bitmap: ImageBitmap) => void;
    reject: (error: Error) => void;
  }>();
  private requestIdCounter = 0;

  constructor() {
    this.initializeWorker();
  }

  /**
   * Rasterize SVG text to ImageBitmap
   */
  async rasterizeSvgToBitmap(
    svgText: string,
    width: number,
    height: number,
    options: SVGRasterOptions = {}
  ): Promise<ImageBitmap> {
    // Use worker if available and not explicitly disabled
    if (this.workerAvailable && options.useWorker !== false) {
      return this.rasterizeWithWorker(svgText, width, height, options);
    } else {
      return this.rasterizeMainThread(svgText, width, height, options);
    }
  }

  /**
   * Check if worker-based rasterization is available
   */
  isWorkerAvailable(): boolean {
    return this.workerAvailable;
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.workerAvailable = false;
    
    // Reject all pending requests
    for (const { reject } of this.pendingRequests.values()) {
      reject(new Error('SVGRasterizer disposed'));
    }
    this.pendingRequests.clear();
  }

  /**
   * Initialize the worker
   */
  private initializeWorker(): void {
    try {
      // Check for Worker and OffscreenCanvas support
      if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') {
        console.warn('Worker or OffscreenCanvas not supported, using main-thread fallback');
        return;
      }

      // Create worker from module
      this.worker = new Worker(
        new URL('./svgRasterWorker.ts', import.meta.url),
        { type: 'module' }
      );

      this.worker.onmessage = this.handleWorkerMessage.bind(this);
      this.worker.onerror = this.handleWorkerError.bind(this);
      
      this.workerAvailable = true;
      
    } catch (error) {
      console.warn('Failed to initialize SVG raster worker:', error);
      this.workerAvailable = false;
    }
  }

  /**
   * Handle worker message responses
   */
  private handleWorkerMessage(event: MessageEvent<RasterResponse>): void {
    const { type, id, bitmap, error } = event.data;
    
    const pending = this.pendingRequests.get(id);
    if (!pending) return;
    
    this.pendingRequests.delete(id);
    
    if (type === 'raster:done' && bitmap) {
      pending.resolve(bitmap);
    } else if (type === 'raster:error') {
      pending.reject(new Error(error || 'Worker rasterization failed'));
    }
  }

  /**
   * Handle worker errors
   */
  private handleWorkerError(event: ErrorEvent): void {
    console.error('SVG raster worker error:', event.error);
    
    // Reject all pending requests and fall back to main thread
    for (const { reject } of this.pendingRequests.values()) {
      reject(new Error('Worker error: ' + event.message));
    }
    this.pendingRequests.clear();
    
    // Disable worker
    this.workerAvailable = false;
  }

  /**
   * Rasterize using background worker
   */
  private async rasterizeWithWorker(
    svgText: string,
    width: number,
    height: number,
    options: SVGRasterOptions
  ): Promise<ImageBitmap> {
    if (!this.worker) {
      throw new Error('Worker not available');
    }

    const id = `raster_${++this.requestIdCounter}`;
    
    return new Promise<ImageBitmap>((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      
      const request: RasterRequest = {
        type: 'raster',
        id,
        svgText,
        width,
        height,
        teamColor: options.teamColor,
        options: {
          backgroundColor: options.backgroundColor,
          scale: options.scale
        }
      };
      
      this.worker!.postMessage(request);
      
      // Timeout fallback
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('Worker rasterization timeout'));
        }
      }, 5000);
    });
  }

  /**
   * Fallback rasterization on main thread
   */
  private async rasterizeMainThread(
    svgText: string,
    width: number,
    height: number,
    options: SVGRasterOptions
  ): Promise<ImageBitmap> {
    // Create offscreen canvas
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get 2D context');
    }

    // Clear with background
    ctx.clearRect(0, 0, width, height);
    if (options.backgroundColor) {
      ctx.fillStyle = options.backgroundColor;
      ctx.fillRect(0, 0, width, height);
    }

    // Apply team color tinting if specified
    let processedSvg = svgText;
    if (options.teamColor) {
      processedSvg = this.applySvgTeamColorTinting(svgText, options.teamColor);
    }

    // Create blob URL and load image
    const svgBlob = new Blob([processedSvg], { type: 'image/svg+xml' });
    const svgUrl = URL.createObjectURL(svgBlob);

    try {
      const img = await this.loadImage(svgUrl);
      
      // Apply scaling
      const scale = options.scale || 1;
      const drawWidth = img.width * scale;
      const drawHeight = img.height * scale;
      const offsetX = (width - drawWidth) / 2;
      const offsetY = (height - drawHeight) / 2;
      
      ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
      
      // Convert to ImageBitmap if available, otherwise use canvas
      if (typeof createImageBitmap !== 'undefined') {
        return await createImageBitmap(canvas);
      } else {
        // Fallback: return canvas as ImageBitmap-like object
        return canvas as any;
      }
      
    } finally {
      URL.revokeObjectURL(svgUrl);
    }
  }

  /**
   * Apply team color tinting to SVG
   */
  private applySvgTeamColorTinting(svgText: string, teamColor: string): string {
    return svgText
      .replace(/<g[^>]*id="hull"[^>]*>([\s\S]*?)<\/g>/g, (match, content) => {
        const updatedContent = content.replace(/fill="[^"]*"/g, `fill="${teamColor}"`);
        return match.replace(content, updatedContent);
      })
      .replace(/<g[^>]*id="accent"[^>]*>([\s\S]*?)<\/g>/g, (match, content) => {
        const updatedContent = content.replace(/fill="[^"]*"/g, `fill="${this.adjustColorBrightness(teamColor, 0.3)}"`);
        return match.replace(content, updatedContent);
      });
  }

  /**
   * Adjust color brightness
   */
  private adjustColorBrightness(color: string, factor: number): string {
    if (!color.startsWith('#')) return color;
    
    const hex = color.slice(1);
    const r = Math.min(255, Math.floor(parseInt(hex.slice(0, 2), 16) * (1 + factor)));
    const g = Math.min(255, Math.floor(parseInt(hex.slice(2, 4), 16) * (1 + factor)));
    const b = Math.min(255, Math.floor(parseInt(hex.slice(4, 6), 16) * (1 + factor)));
    
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  /**
   * Load image with promise wrapper
   */
  private loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load SVG image'));
      img.src = url;
    });
  }
}

// Global instance for convenience
let globalRasterizer: SVGRasterizer | null = null;

/**
 * Get the global SVG rasterizer instance
 */
export function getSVGRasterizer(): SVGRasterizer {
  if (!globalRasterizer) {
    globalRasterizer = new SVGRasterizer();
  }
  return globalRasterizer;
}

/**
 * Convenience function for rasterizing SVG
 */
export async function rasterizeSvgToBitmap(
  svgText: string,
  width: number,
  height: number,
  options: SVGRasterOptions = {}
): Promise<ImageBitmap> {
  return getSVGRasterizer().rasterizeSvgToBitmap(svgText, width, height, options);
}