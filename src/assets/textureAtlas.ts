// Texture atlas system for efficient sprite batching
// Implements shelf-based bin packing for power-of-two atlas textures

export interface AtlasEntry {
  // Position and size in the atlas texture (pixels)
  x: number;
  y: number;
  width: number;
  height: number;
  
  // UV coordinates (normalized 0-1)
  uvX: number;
  uvY: number;
  uvWidth: number;
  uvHeight: number;
  
  // Metadata
  key: string;
  originalWidth: number;
  originalHeight: number;
}

export interface AtlasPackingOptions {
  maxAtlasSize?: number;
  padding?: number;
  powerOfTwo?: boolean;
  allowRotation?: boolean;
}

interface Shelf {
  y: number;
  height: number;
  width: number;
  usedWidth: number;
}

export class TextureAtlas {
  private gl: WebGL2RenderingContext | WebGLRenderingContext;
  private atlasTexture: WebGLTexture | null = null;
  private atlasCanvas: HTMLCanvasElement | null = null;
  private atlasContext: CanvasRenderingContext2D | null = null;
  private entries: Map<string, AtlasEntry> = new Map();
  
  // Atlas configuration
  private atlasWidth: number = 1024;
  private atlasHeight: number = 1024;
  private padding: number = 1;
  private nextAtlasId: number = 0;
  
  // Packing state
  private shelves: Shelf[] = [];
  private usedHeight: number = 0;
  private isDirty: boolean = false;
  
  constructor(
    gl: WebGL2RenderingContext | WebGLRenderingContext, 
    options: AtlasPackingOptions = {}
  ) {
    this.gl = gl;
    this.atlasWidth = this.findPowerOfTwo(options.maxAtlasSize || 1024);
    this.atlasHeight = this.atlasWidth; // Square atlas
    this.padding = options.padding || 1;
    
    this.initializeAtlas();
  }
  
  /**
   * Add an image/canvas to the atlas
   */
  addEntry(
    key: string, 
    source: HTMLCanvasElement | HTMLImageElement | ImageBitmap,
    width?: number,
    height?: number
  ): AtlasEntry | null {
    // Check if entry already exists
    if (this.entries.has(key)) {
      return this.entries.get(key)!;
    }
    
    const sourceWidth = width || source.width;
    const sourceHeight = height || source.height;
    
    // Find space in atlas using shelf algorithm
    const position = this.findSpace(sourceWidth, sourceHeight);
    if (!position) {
      console.warn(`Cannot fit ${key} (${sourceWidth}x${sourceHeight}) in atlas`);
      return null;
    }
    
    // Create atlas entry
    const entry: AtlasEntry = {
      x: position.x,
      y: position.y,
      width: sourceWidth,
      height: sourceHeight,
      uvX: position.x / this.atlasWidth,
      uvY: position.y / this.atlasHeight,
      uvWidth: sourceWidth / this.atlasWidth,
      uvHeight: sourceHeight / this.atlasHeight,
      key,
      originalWidth: sourceWidth,
      originalHeight: sourceHeight
    };
    
    // Draw to atlas canvas
    if (this.atlasContext) {
      this.atlasContext.drawImage(
        source as CanvasImageSource,
        0, 0, sourceWidth, sourceHeight,
        position.x, position.y, sourceWidth, sourceHeight
      );
    }
    
    this.entries.set(key, entry);
    this.isDirty = true;
    
    return entry;
  }
  
  /**
   * Get an atlas entry by key
   */
  getEntry(key: string): AtlasEntry | null {
    return this.entries.get(key) || null;
  }
  
  /**
   * Get all atlas entries
   */
  getAllEntries(): AtlasEntry[] {
    return Array.from(this.entries.values());
  }
  
  /**
   * Get the WebGL texture for this atlas
   */
  getTexture(): WebGLTexture | null {
    if (this.isDirty) {
      this.updateGLTexture();
    }
    return this.atlasTexture;
  }
  
  /**
   * Get atlas statistics
   */
  getStats(): {
    atlasSize: { width: number; height: number };
    entryCount: number;
    utilization: number;
    freeSpace: number;
  } {
    const totalPixels = this.atlasWidth * this.atlasHeight;
    const usedPixels = Array.from(this.entries.values())
      .reduce((sum, entry) => sum + (entry.width * entry.height), 0);
    
    return {
      atlasSize: { width: this.atlasWidth, height: this.atlasHeight },
      entryCount: this.entries.size,
      utilization: usedPixels / totalPixels,
      freeSpace: totalPixels - usedPixels
    };
  }
  
  /**
   * Clear all entries and reset atlas
   */
  clear(): void {
    this.entries.clear();
    this.shelves = [];
    this.usedHeight = 0;
    this.isDirty = false;
    
    if (this.atlasContext) {
      this.atlasContext.clearRect(0, 0, this.atlasWidth, this.atlasHeight);
    }
  }
  
  /**
   * Create a debug visualization of the atlas
   */
  createDebugCanvas(): HTMLCanvasElement | null {
    if (!this.atlasCanvas) return null;
    
    const debugCanvas = document.createElement('canvas');
    debugCanvas.width = this.atlasWidth;
    debugCanvas.height = this.atlasHeight;
    const ctx = debugCanvas.getContext('2d');
    if (!ctx) return null;
    
    // Copy atlas content
    ctx.drawImage(this.atlasCanvas, 0, 0);
    
    // Draw entry boundaries
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 1;
    
    for (const entry of this.entries.values()) {
      ctx.strokeRect(entry.x, entry.y, entry.width, entry.height);
      
      // Draw key label
      ctx.fillStyle = '#ffff00';
      ctx.font = '12px Arial';
      ctx.fillText(entry.key, entry.x + 2, entry.y + 12);
    }
    
    // Draw shelf boundaries
    ctx.strokeStyle = '#00ff00';
    for (const shelf of this.shelves) {
      ctx.strokeRect(0, shelf.y, shelf.usedWidth, shelf.height);
    }
    
    return debugCanvas;
  }
  
  /**
   * Dispose WebGL resources
   */
  dispose(): void {
    if (this.atlasTexture) {
      this.gl.deleteTexture(this.atlasTexture);
      this.atlasTexture = null;
    }
    
    this.atlasCanvas = null;
    this.atlasContext = null;
    this.entries.clear();
    this.shelves = [];
  }
  
  // -- Private implementation methods --
  
  private initializeAtlas(): void {
    // Create canvas for building atlas
    this.atlasCanvas = document.createElement('canvas');
    this.atlasCanvas.width = this.atlasWidth;
    this.atlasCanvas.height = this.atlasHeight;
    this.atlasContext = this.atlasCanvas.getContext('2d');
    
    if (!this.atlasContext) {
      throw new Error('Failed to create 2D context for atlas canvas');
    }
    
    // Clear to transparent
    this.atlasContext.clearRect(0, 0, this.atlasWidth, this.atlasHeight);
    
    // Create WebGL texture
    this.atlasTexture = this.gl.createTexture();
    if (!this.atlasTexture) {
      throw new Error('Failed to create WebGL texture for atlas');
    }
  }
  
  private findSpace(width: number, height: number): { x: number; y: number } | null {
    const paddedWidth = width + this.padding * 2;
    const paddedHeight = height + this.padding * 2;
    
    // Try to fit in existing shelves
    for (const shelf of this.shelves) {
      if (shelf.height >= paddedHeight && 
          shelf.width - shelf.usedWidth >= paddedWidth) {
        const position = {
          x: shelf.usedWidth + this.padding,
          y: shelf.y + this.padding
        };
        shelf.usedWidth += paddedWidth;
        return position;
      }
    }
    
    // Create new shelf if there's vertical space
    if (this.usedHeight + paddedHeight <= this.atlasHeight) {
      const shelf: Shelf = {
        y: this.usedHeight,
        height: paddedHeight,
        width: this.atlasWidth,
        usedWidth: paddedWidth
      };
      
      this.shelves.push(shelf);
      this.usedHeight += paddedHeight;
      
      return {
        x: this.padding,
        y: shelf.y + this.padding
      };
    }
    
    // No space available
    return null;
  }
  
  private updateGLTexture(): void {
    if (!this.atlasTexture || !this.atlasCanvas) return;
    
    const gl = this.gl;
    
    gl.bindTexture(gl.TEXTURE_2D, this.atlasTexture);
    gl.pixelStorei((gl as any).UNPACK_PREMULTIPLY_ALPHA_WEBGL ?? 0x8063, 0);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      this.atlasCanvas
    );
    
    // Set filtering and wrapping
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    
    // Generate mipmaps if power of two
    if (this.isPowerOfTwo(this.atlasWidth) && this.isPowerOfTwo(this.atlasHeight)) {
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    }
    
    this.isDirty = false;
  }
  
  private findPowerOfTwo(size: number): number {
    let result = 1;
    while (result < size) {
      result *= 2;
    }
    return Math.min(result, 4096); // Cap at 4K for compatibility
  }
  
  private isPowerOfTwo(value: number): boolean {
    return value > 0 && (value & (value - 1)) === 0;
  }
}

/**
 * Utility class for managing multiple texture atlases
 */
export class AtlasManager {
  private gl: WebGL2RenderingContext | WebGLRenderingContext;
  private atlases: Map<string, TextureAtlas> = new Map();
  private defaultOptions: AtlasPackingOptions;
  
  constructor(
    gl: WebGL2RenderingContext | WebGLRenderingContext,
    options: AtlasPackingOptions = {}
  ) {
    this.gl = gl;
    this.defaultOptions = {
      maxAtlasSize: 1024,
      padding: 1,
      powerOfTwo: true,
      allowRotation: false,
      ...options
    };
  }
  
  /**
   * Get or create an atlas with the given name
   */
  getAtlas(name: string): TextureAtlas {
    if (!this.atlases.has(name)) {
      this.atlases.set(name, new TextureAtlas(this.gl, this.defaultOptions));
    }
    return this.atlases.get(name)!;
  }
  
  /**
   * Add an entry to a specific atlas
   */
  addToAtlas(
    atlasName: string,
    key: string,
    source: HTMLCanvasElement | HTMLImageElement | ImageBitmap,
    width?: number,
    height?: number
  ): AtlasEntry | null {
    const atlas = this.getAtlas(atlasName);
    return atlas.addEntry(key, source, width, height);
  }
  
  /**
   * Find which atlas contains a given key
   */
  findEntry(key: string): { atlas: TextureAtlas; entry: AtlasEntry } | null {
    for (const atlas of this.atlases.values()) {
      const entry = atlas.getEntry(key);
      if (entry) {
        return { atlas, entry };
      }
    }
    return null;
  }
  
  /**
   * Get combined statistics for all atlases
   */
  getGlobalStats(): {
    atlasCount: number;
    totalEntries: number;
    averageUtilization: number;
  } {
    const stats = Array.from(this.atlases.values()).map(atlas => atlas.getStats());
    
    return {
      atlasCount: this.atlases.size,
      totalEntries: stats.reduce((sum, stat) => sum + stat.entryCount, 0),
      averageUtilization: stats.length > 0 
        ? stats.reduce((sum, stat) => sum + stat.utilization, 0) / stats.length 
        : 0
    };
  }
  
  /**
   * Dispose all atlases
   */
  dispose(): void {
    for (const atlas of this.atlases.values()) {
      atlas.dispose();
    }
    this.atlases.clear();
  }
}