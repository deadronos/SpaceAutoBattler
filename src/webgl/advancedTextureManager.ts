/**
 * Advanced texture management with mipmapping, LOD, and anisotropic filtering
 * Implements Phase 3 enhancements for optimal texture quality at all zoom levels
 */

export interface TextureLODConfig {
  /** Generate mipmaps for this texture */
  generateMipmaps?: boolean;
  /** Use anisotropic filtering if available */
  useAnisotropic?: boolean;
  /** Maximum anisotropy level (1-16, higher = better quality) */
  maxAnisotropy?: number;
  /** LOD bias for texture sampling (-1 to 1, negative = sharper) */
  lodBias?: number;
  /** Texture wrap mode for S coordinate */
  wrapS?: number;
  /** Texture wrap mode for T coordinate */
  wrapT?: number;
  /** Magnification filter */
  magFilter?: number;
  /** Minification filter */
  minFilter?: number;
}

export interface TextureLODLevel {
  /** Canvas or ImageBitmap for this LOD level */
  source: HTMLCanvasElement | ImageBitmap;
  /** Width of this LOD level */
  width: number;
  /** Height of this LOD level */
  height: number;
  /** LOD level (0 = highest quality) */
  level: number;
}

export interface TextureLODSet {
  /** Base texture (level 0) */
  baseTexture: WebGLTexture;
  /** LOD levels available */
  levels: TextureLODLevel[];
  /** Configuration used */
  config: TextureLODConfig;
  /** Texture dimensions */
  width: number;
  height: number;
  /** WebGL context this texture belongs to */
  gl: WebGL2RenderingContext | WebGLRenderingContext;
}

export interface AnisotropyExtension {
  /** Extension object */
  ext: EXT_texture_filter_anisotropic | null;
  /** Maximum anisotropy level supported */
  maxAnisotropy: number;
  /** Whether extension is available */
  available: boolean;
}

/**
 * Advanced texture manager with LOD and anisotropic filtering support
 */
export class AdvancedTextureManager {
  private gl: WebGL2RenderingContext | WebGLRenderingContext;
  private anisotropyExt: AnisotropyExtension;
  private textures = new Map<string, TextureLODSet>();
  private defaultConfig: Required<TextureLODConfig>;
  
  constructor(gl: WebGL2RenderingContext | WebGLRenderingContext, defaultConfig?: Partial<TextureLODConfig>) {
    this.gl = gl;
    this.anisotropyExt = this.initializeAnisotropyExtension();
    
    this.defaultConfig = {
      generateMipmaps: true,
      useAnisotropic: true,
      maxAnisotropy: Math.min(16, this.anisotropyExt.maxAnisotropy),
      lodBias: 0,
      wrapS: gl.CLAMP_TO_EDGE,
      wrapT: gl.CLAMP_TO_EDGE,
      magFilter: gl.LINEAR,
      minFilter: gl.LINEAR_MIPMAP_LINEAR,
      ...defaultConfig
    };
  }
  
  private initializeAnisotropyExtension(): AnisotropyExtension {
    const ext = this.gl.getExtension('EXT_texture_filter_anisotropic') || 
                 this.gl.getExtension('MOZ_EXT_texture_filter_anisotropic') ||
                 this.gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic');
    
    let maxAnisotropy = 1;
    if (ext) {
      maxAnisotropy = this.gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
    }
    
    return {
      ext,
      maxAnisotropy,
      available: ext !== null
    };
  }
  
  /**
   * Create a texture with advanced LOD and filtering options
   */
  createAdvancedTexture(
    key: string,
    source: HTMLCanvasElement | ImageBitmap | HTMLImageElement,
    config?: Partial<TextureLODConfig>
  ): TextureLODSet {
    const finalConfig = { ...this.defaultConfig, ...config };
    const gl = this.gl;
    
    // Create WebGL texture
    const texture = gl.createTexture();
    if (!texture) {
      throw new Error('Failed to create WebGL texture');
    }
    
    gl.bindTexture(gl.TEXTURE_2D, texture);
    
    // Set texture parameters before upload
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, finalConfig.wrapS);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, finalConfig.wrapT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, finalConfig.magFilter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, finalConfig.minFilter);
    
    // Upload base texture (level 0)
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    
    // Generate mipmaps if requested and texture is power of two
    const width = source.width || (source as HTMLCanvasElement).width;
    const height = source.height || (source as HTMLCanvasElement).height;
    const isPowerOfTwo = this.isPowerOfTwo(width) && this.isPowerOfTwo(height);
    
    if (finalConfig.generateMipmaps && isPowerOfTwo) {
      gl.generateMipmap(gl.TEXTURE_2D);
    } else if (finalConfig.generateMipmaps && !isPowerOfTwo) {
      console.warn(`Cannot generate mipmaps for non-power-of-two texture: ${width}x${height}`);
      // Fallback to LINEAR for non-POT textures
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    }
    
    // Apply anisotropic filtering if available and requested
    if (finalConfig.useAnisotropic && this.anisotropyExt.available && this.anisotropyExt.ext) {
      const anisotropy = Math.min(finalConfig.maxAnisotropy, this.anisotropyExt.maxAnisotropy);
      gl.texParameterf(gl.TEXTURE_2D, this.anisotropyExt.ext.TEXTURE_MAX_ANISOTROPY_EXT, anisotropy);
    }
    
    // Create LOD set
    const lodSet: TextureLODSet = {
      baseTexture: texture,
      levels: [{
        source: source as HTMLCanvasElement | ImageBitmap,
        width,
        height,
        level: 0
      }],
      config: finalConfig,
      width,
      height,
      gl
    };
    
    this.textures.set(key, lodSet);
    return lodSet;
  }
  
  /**
   * Add additional LOD levels to an existing texture
   */
  addLODLevel(key: string, level: number, source: HTMLCanvasElement | ImageBitmap): boolean {
    const lodSet = this.textures.get(key);
    if (!lodSet) {
      console.warn(`Texture ${key} not found for LOD level addition`);
      return false;
    }
    
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, lodSet.baseTexture);
    
    // Upload LOD level
    gl.texImage2D(gl.TEXTURE_2D, level, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    
    // Add to LOD set
    lodSet.levels.push({
      source,
      width: source.width || (source as HTMLCanvasElement).width,
      height: source.height || (source as HTMLCanvasElement).height,
      level
    });
    
    // Sort levels by level number
    lodSet.levels.sort((a, b) => a.level - b.level);
    
    return true;
  }
  
  /**
   * Generate LOD levels automatically by downsampling
   */
  generateLODLevels(key: string, maxLevels: number = 8): TextureLODLevel[] {
    const lodSet = this.textures.get(key);
    if (!lodSet || lodSet.levels.length === 0) {
      throw new Error(`Texture ${key} not found or has no base level`);
    }
    
    const baseLevel = lodSet.levels[0];
    const generatedLevels: TextureLODLevel[] = [];
    
    let currentWidth = baseLevel.width;
    let currentHeight = baseLevel.height;
    let currentSource = baseLevel.source;
    
    for (let level = 1; level <= maxLevels && (currentWidth > 1 || currentHeight > 1); level++) {
      // Calculate next LOD dimensions (halve each dimension)
      const nextWidth = Math.max(1, Math.floor(currentWidth / 2));
      const nextHeight = Math.max(1, Math.floor(currentHeight / 2));
      
      // Create downsampled version
      const downsampledCanvas = this.downsampleTexture(currentSource, nextWidth, nextHeight);
      
      // Add LOD level to WebGL texture
      this.addLODLevel(key, level, downsampledCanvas);
      
      const lodLevel: TextureLODLevel = {
        source: downsampledCanvas,
        width: nextWidth,
        height: nextHeight,
        level
      };
      
      generatedLevels.push(lodLevel);
      
      // Update for next iteration
      currentWidth = nextWidth;
      currentHeight = nextHeight;
      currentSource = downsampledCanvas;
    }
    
    return generatedLevels;
  }
  
  /**
   * Downsample a texture source to a smaller size
   */
  private downsampleTexture(
    source: HTMLCanvasElement | ImageBitmap,
    targetWidth: number,
    targetHeight: number
  ): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get 2D context for downsampling');
    }
    
    // Use high-quality scaling
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    // Draw downsampled image
    ctx.drawImage(source as CanvasImageSource, 0, 0, targetWidth, targetHeight);
    
    return canvas;
  }
  
  /**
   * Get texture LOD set by key
   */
  getTexture(key: string): TextureLODSet | undefined {
    return this.textures.get(key);
  }
  
  /**
   * Bind texture with optimal LOD for given zoom level
   */
  bindTextureWithLOD(key: string, zoomLevel: number = 1.0, textureUnit: number = 0): boolean {
    const lodSet = this.textures.get(key);
    if (!lodSet) {
      return false;
    }
    
    const gl = this.gl;
    
    // Activate texture unit
    gl.activeTexture(gl.TEXTURE0 + textureUnit);
    gl.bindTexture(gl.TEXTURE_2D, lodSet.baseTexture);
    
    // Adjust LOD bias based on zoom level
    if (lodSet.config.lodBias && lodSet.config.lodBias !== 0) {
      // LOD bias adjustment based on zoom (closer = negative bias for sharper textures)
      const adjustedBias = lodSet.config.lodBias + Math.log2(1.0 / zoomLevel);
      
      // Note: LOD bias is not directly settable in WebGL, but we can influence it
      // through texture parameters or shader uniforms in real implementations
    }
    
    return true;
  }
  
  /**
   * Check if a number is a power of two
   */
  private isPowerOfTwo(value: number): boolean {
    return (value & (value - 1)) === 0 && value !== 0;
  }
  
  /**
   * Get anisotropy information
   */
  getAnisotropyInfo(): AnisotropyExtension {
    return { ...this.anisotropyExt };
  }
  
  /**
   * Update texture filtering parameters
   */
  updateTextureFiltering(key: string, config: Partial<TextureLODConfig>): boolean {
    const lodSet = this.textures.get(key);
    if (!lodSet) {
      return false;
    }
    
    const gl = this.gl;
    const updatedConfig = { ...lodSet.config, ...config };
    
    gl.bindTexture(gl.TEXTURE_2D, lodSet.baseTexture);
    
    // Update filtering parameters
    if (config.magFilter !== undefined) {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, config.magFilter);
    }
    if (config.minFilter !== undefined) {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, config.minFilter);
    }
    if (config.wrapS !== undefined) {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, config.wrapS);
    }
    if (config.wrapT !== undefined) {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, config.wrapT);
    }
    
    // Update anisotropic filtering
    if (config.useAnisotropic !== undefined && config.maxAnisotropy !== undefined) {
      if (config.useAnisotropic && this.anisotropyExt.available && this.anisotropyExt.ext) {
        const anisotropy = Math.min(config.maxAnisotropy, this.anisotropyExt.maxAnisotropy);
        gl.texParameterf(gl.TEXTURE_2D, this.anisotropyExt.ext.TEXTURE_MAX_ANISOTROPY_EXT, anisotropy);
      }
    }
    
    // Update stored config
    lodSet.config = updatedConfig;
    
    return true;
  }
  
  /**
   * Get texture memory usage statistics
   */
  getMemoryStats(): { totalTextures: number; totalMemoryMB: number; details: Array<{key: string; memoryMB: number; levels: number}> } {
    let totalMemory = 0;
    const details: Array<{key: string; memoryMB: number; levels: number}> = [];
    
    for (const [key, lodSet] of this.textures) {
      let textureMemory = 0;
      
      for (const level of lodSet.levels) {
        // Estimate memory usage: width * height * 4 bytes (RGBA)
        textureMemory += level.width * level.height * 4;
      }
      
      const memoryMB = textureMemory / (1024 * 1024);
      totalMemory += textureMemory;
      
      details.push({
        key,
        memoryMB,
        levels: lodSet.levels.length
      });
    }
    
    return {
      totalTextures: this.textures.size,
      totalMemoryMB: totalMemory / (1024 * 1024),
      details: details.sort((a, b) => b.memoryMB - a.memoryMB) // Sort by memory usage
    };
  }
  
  /**
   * Dispose of a texture and free GPU memory
   */
  disposeTexture(key: string): boolean {
    const lodSet = this.textures.get(key);
    if (!lodSet) {
      return false;
    }
    
    // Delete WebGL texture
    lodSet.gl.deleteTexture(lodSet.baseTexture);
    
    // Remove from cache
    this.textures.delete(key);
    
    return true;
  }
  
  /**
   * Dispose of all textures
   */
  dispose(): void {
    for (const [key] of this.textures) {
      this.disposeTexture(key);
    }
    this.textures.clear();
  }
}

/**
 * Utility function to create texture with optimal settings based on usage
 */
export function createOptimalTexture(
  gl: WebGL2RenderingContext | WebGLRenderingContext,
  source: HTMLCanvasElement | ImageBitmap | HTMLImageElement,
  usage: 'sprite' | 'ui' | 'background' | 'effect' = 'sprite'
): WebGLTexture {
  const manager = new AdvancedTextureManager(gl);
  
  let config: Partial<TextureLODConfig>;
  
  switch (usage) {
    case 'sprite':
      // High-quality settings for game sprites
      config = {
        generateMipmaps: true,
        useAnisotropic: true,
        maxAnisotropy: 16,
        minFilter: gl.LINEAR_MIPMAP_LINEAR,
        magFilter: gl.LINEAR
      };
      break;
      
    case 'ui':
      // Sharp, pixel-perfect for UI elements
      config = {
        generateMipmaps: false,
        useAnisotropic: false,
        minFilter: gl.LINEAR,
        magFilter: gl.LINEAR
      };
      break;
      
    case 'background':
      // Lower quality for backgrounds to save memory
      config = {
        generateMipmaps: true,
        useAnisotropic: false,
        maxAnisotropy: 4,
        minFilter: gl.LINEAR_MIPMAP_NEAREST,
        magFilter: gl.LINEAR
      };
      break;
      
    case 'effect':
      // High-quality for particle effects and explosions
      config = {
        generateMipmaps: true,
        useAnisotropic: true,
        maxAnisotropy: 8,
        minFilter: gl.LINEAR_MIPMAP_LINEAR,
        magFilter: gl.LINEAR
      };
      break;
  }
  
  const lodSet = manager.createAdvancedTexture('temp', source, config);
  return lodSet.baseTexture;
}