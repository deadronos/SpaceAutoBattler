// Minimal, typed WebGL renderer focused on texture baking and lifecycle
// Implements the public API expected by main.ts and tests.

import { AssetsConfig, Shape2D } from "./config/assets/assetsConfig";
import RendererConfig from "./config/rendererConfig";
import TeamsConfig from "./config/teamsConfig";
import type { GameState } from "./types";
import {
  createExplosionEffect,
  resetExplosionEffect,
  ExplosionEffect,
} from "./entities";
import {
  acquireTexture,
  releaseTexture,
  acquireSprite,
  releaseSprite,
  acquireEffect,
  releaseEffect,
  makePooled,
} from "./pools";
import { InstancedRenderer, InstanceData, BatchRenderCall } from "./webgl/instancedRenderer";
import { AtlasManager } from "./assets/textureAtlas";
import { AdvancedTextureManager } from "./webgl/advancedTextureManager";

export class WebGLRenderer {
  private canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext | WebGLRenderingContext | null = null;
  // Renderer may run its own loop in advanced impls (not used here)
  public providesOwnLoop = false;

  // Cache of baked textures keyed by asset key
  private shapeTextures: Record<string, WebGLTexture> = {};
  // Last-seen GameState (to support release to pool during dispose)
  private gameState: GameState | null = null;
  // Optional textured-quad resources (not required by tests)
  private quadVBO: WebGLBuffer | null = null;
  private quadProg: WebGLProgram | null = null;
  // Optional FBO resources for render-to-texture
  private fbo: WebGLFramebuffer | null = null;
  private fboTex: WebGLTexture | null = null;
  
  // Phase 2: Instanced rendering and atlas support
  private instancedRenderer: InstancedRenderer | null = null;
  private atlasManager: AtlasManager | null = null;
  private instancedRenderingEnabled: boolean = false;

  // Phase 3: Advanced texture management
  private advancedTextures: AdvancedTextureManager | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  // Initialize GL context and basic state
  init(): boolean {
    try {
      const gl =
        (this.canvas.getContext("webgl2") as WebGL2RenderingContext | null) ||
        (this.canvas.getContext("webgl") as WebGLRenderingContext | null);
      if (!gl) return false;
      this.gl = gl;
      gl.clearColor(0.02, 0.03, 0.06, 1.0);
      
      // Initialize Phase 2 components
      this.initializeInstancedRendering();
      
      // Initialize Phase 3 components
      this.initializeAdvancedTextures();
      
      // Prepare starfield texture (procedural) lazily
      (this as any)._starfield = (this as any)._starfield || null;
      (this as any)._starfieldSize = (this as any)._starfieldSize || 1024;
      // Lazily initialize optional programs/buffers when used
      return true;
    } catch {
      return false;
    }

    // Post-init create GL resources for fullscreen quad used to draw starfield
    try {
      this.quadVBO = (this.gl as WebGLRenderingContext).createBuffer();
      const glr = this.gl as WebGLRenderingContext;
      const verts = new Float32Array([
        -1, -1, 0, 0, 1, -1, 1, 0, -1, 1, 0, 1, 1, 1, 1, 1,
      ]);
      glr.bindBuffer(glr.ARRAY_BUFFER, this.quadVBO);
      glr.bufferData(glr.ARRAY_BUFFER, verts, glr.STATIC_DRAW);
      // Simple textured quad shader
      const vsSrc =
        "attribute vec2 aPos; attribute vec2 aUV; varying vec2 vUV; void main(){ vUV = aUV; gl_Position = vec4(aPos,0.0,1.0); }";
      const fsSrc =
        "precision mediump float; varying vec2 vUV; uniform sampler2D uTex; uniform vec2 uUVOffset; void main(){ vec2 uv = vUV + uUVOffset; gl_FragColor = texture2D(uTex, uv); }";
      const vs = glr.createShader(glr.VERTEX_SHADER)!;
      const fs = glr.createShader(glr.FRAGMENT_SHADER)!;
      glr.shaderSource(vs, vsSrc);
      glr.shaderSource(fs, fsSrc);
      glr.compileShader(vs);
      glr.compileShader(fs);
      const prog = glr.createProgram()!;
      glr.attachShader(prog, vs);
      glr.attachShader(prog, fs);
      glr.linkProgram(prog);
      this.quadProg = prog;
    } catch {}
    return true;
  }

  // Called when canvas backing store size changes
  updateScale(): void {
    if (!this.gl) return;
    try {
      this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    } catch {}
  }

  isRunning(): boolean {
    return false;
  }

  // Render a state frame. This stub clears the screen and ensures
  // textures for present ship types are baked and cached.
  renderState(state: GameState, _interpolation = 0): void {
    if (!this.gl) return;
    // Remember the state so dispose can release assets back to the pool
    this.gameState = state;
    const gl = this.gl as WebGLRenderingContext;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Ensure starfield texture exists and draw it first
    try {
      if (!(this as any)._starfield) {
        const size = (this as any)._starfieldSize || 1024;
        const cvs = document.createElement("canvas");
        cvs.width = size;
        cvs.height = size;
        const ctx = cvs.getContext("2d")!;
        // Fill gradient background
        const g = ctx.createLinearGradient(0, 0, 0, size);
        g.addColorStop(0, "#001020");
        g.addColorStop(1, "#000010");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, size, size);
        // Draw procedural stars (density from rendererConfig.starfield.density if available)
        let density = 0.0004;
        try {
          const rc = RendererConfig;
          if (rc && rc.starfield && typeof rc.starfield.density === "number")
            density = rc.starfield.density;
        } catch {}
        const stars = Math.floor(size * size * density); // density
        for (let i = 0; i < stars; i++) {
          const x = Math.random() * size;
          const y = Math.random() * size;
          const r = Math.random() * 1.2;
          const bright = 0.6 + Math.random() * 0.4;
          ctx.fillStyle = `rgba(255,255,255,${bright})`;
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        }
        // Add a few brighter stars
        for (let i = 0; i < 80; i++) {
          const x = Math.random() * size;
          const y = Math.random() * size;
          ctx.fillStyle = "rgba(255,244,200,1)";
          ctx.beginPath();
          ctx.arc(x, y, 1.6 + Math.random() * 1.8, 0, Math.PI * 2);
          ctx.fill();
        }
        const tex = gl.createTexture()!;
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.pixelStorei((gl as any).UNPACK_PREMULTIPLY_ALPHA_WEBGL ?? 0x8063, 0);
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          cvs,
        );
        
        // Enhanced starfield texture filtering
        this.setupTextureFiltering(gl, size, size);
        
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
        (this as any)._starfield = tex;
      }

      // Draw fullscreen textured quad with starfield (supports parallax via state.camera)
      if (this.quadProg && this.quadVBO) {
        try {
          gl.useProgram(this.quadProg);
          gl.bindBuffer((gl as any).ARRAY_BUFFER, this.quadVBO);
          const aPos = gl.getAttribLocation(this.quadProg, "aPos");
          const aUV = gl.getAttribLocation(this.quadProg, "aUV");
          gl.enableVertexAttribArray(aPos);
          gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 16, 0);
          gl.enableVertexAttribArray(aUV);
          gl.vertexAttribPointer(aUV, 2, gl.FLOAT, false, 16, 8);
          // compute parallax offset from state.camera if present
          let ox = 0,
            oy = 0;
          try {
            const cam = (state as any)?.camera;
            if (cam && typeof cam.x === "number" && typeof cam.y === "number") {
              // parallax factor from config if available
              const pf =
                (typeof (require("./config/rendererConfig") as any).default !==
                "undefined"
                  ? (require("./config/rendererConfig") as any).default
                      .starfield.parallaxFactor
                  : 0.1) || 0.1;
              ox = ((cam.x || 0) * pf) / (this.canvas.width || 1);
              oy = ((cam.y || 0) * pf) / (this.canvas.height || 1);
            }
          } catch {}
          // set a simple uniform for uv offset if the shader supports it; fallback to binding texture only
          const uvOffLoc = gl.getUniformLocation(this.quadProg, "uUVOffset");
          if (uvOffLoc) gl.uniform2f(uvOffLoc, ox, oy);

          gl.activeTexture((gl as any).TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, (this as any)._starfield);
          const loc = gl.getUniformLocation(this.quadProg, "uTex");
          gl.uniform1i(loc, 0);
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

          // Draw additive bloom layer if present
          if ((this as any)._starBloom) {
            try {
              gl.enable(gl.BLEND);
              gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
              gl.activeTexture((gl as any).TEXTURE0);
              gl.bindTexture(gl.TEXTURE_2D, (this as any)._starBloom);
              gl.uniform1i(loc, 0);
              gl.uniform2f(uvOffLoc, ox * 0.6, oy * 0.6);
              gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
              gl.disable(gl.BLEND);
            } catch {}
          }
        } catch {}
      }
    } catch {}

    try {
      const ships = (state && state.ships) || [];
      for (const s of ships) {
        const type = (s && s.type) || "fighter";
        // Determine team color (fall back to palette.shipHull)
        let teamColor = (AssetsConfig as any).palette?.shipHull || "#b0b7c3";
        try {
          if (s && s.team && TeamsConfig && (TeamsConfig as any).teams) {
            const t = (TeamsConfig as any).teams[s.team];
            if (t && t.color) teamColor = t.color;
          }
        } catch {}
        this.bakeShapeToTexture(state, type, teamColor);
        // Acquire a transient sprite object for this ship and rehydrate it.
        try {
          const key = `ship:${type}`;
          const sprite = acquireSprite(
            this.gameState || (state as any),
            key,
            () => ({ type }),
          );
          // Reset/rehydrate runtime fields used by renderer
          type RenderSprite = {
            type: string;
            x?: number;
            y?: number;
            angle?: number;
          };
          const sp = sprite as unknown as RenderSprite;
          try {
            sp.x = s.x || 0;
            sp.y = s.y || 0;
            sp.angle = s.angle || 0;
          } catch {}
          try {
            releaseSprite(this.gameState || (state as any), key, sprite);
          } catch {}
        } catch {}
      }
      // Process visual flashes/effects and use effect pooling for transient objects
      try {
        const flashes = state.flashes || [];
        for (const f of flashes) {
          try {
            const key = `flash`;
            const pooled = acquireEffect(
              this.gameState || (state as any),
              key,
              () =>
                makePooled(
                  createExplosionEffect({ x: f.x || 0, y: f.y || 0 }),
                  (obj, initArgs) => {
                    resetExplosionEffect(obj, initArgs as any);
                    // attach render-only fields
                    (obj as any).ttl = initArgs?.ttl ?? 0.5;
                  },
                ),
              f,
            );
            type RenderFlash = ExplosionEffect & { ttl?: number };
            const ef = pooled as unknown as RenderFlash;
            try {
              if (ef) {
                // ef.x/ef.y already set by reset on acquire; ensure numeric
                ef.x = ef.x || 0;
                ef.y = ef.y || 0;
                ef.ttl = ef.ttl ?? 0.5;
              }
            } catch {}
            try {
              releaseEffect(this.gameState || (state as any), key, pooled);
            } catch {}
          } catch {}
        }
      } catch {}
    } catch {}
  }

  // Pre-bake textures for all known shapes
  preloadAllAssets(): void {
    if (!this.gl) return;
    try {
      const shapes = (AssetsConfig as any).shapes2d || {};
      for (const key of Object.keys(shapes))
        this.bakeShapeToTexture(this.gameState, key);
    } catch {}
  }

  // Testing helper: check if we have a cached texture for a key
  hasCachedTexture(key: string): boolean {
    return !!this.shapeTextures[key];
  }

  /**
   * Setup enhanced texture filtering with mipmapping support
   */
  private setupTextureFiltering(gl: WebGLRenderingContext | WebGL2RenderingContext, width: number, height: number): void {
    // Use advanced texture management if available
    if (this.advancedTextures) {
      // Let AdvancedTextureManager handle optimal filtering
      const config = {
        generateMipmaps: this.isPowerOfTwo(width) && this.isPowerOfTwo(height),
        useAnisotropic: true,
        maxAnisotropy: 8, // Higher quality for game assets
        lodBias: 0
      };
      
      // Note: AdvancedTextureManager would typically handle the texture creation,
      // but here we're just setting up filtering for an existing texture
      if (config.generateMipmaps) {
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      } else {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      }
      
      // Apply anisotropic filtering using AdvancedTextureManager's extension
      if (config.useAnisotropic) {
        const anisotropyInfo = this.advancedTextures.getAnisotropyInfo();
        if (anisotropyInfo.available && anisotropyInfo.ext) {
          const ext = anisotropyInfo.ext;
          const maxAnisotropy = gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
          const anisotropy = Math.min(config.maxAnisotropy, maxAnisotropy);
          gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, anisotropy);
        }
      }
    } else {
      // Fallback to basic filtering
      const isPOT = this.isPowerOfTwo(width) && this.isPowerOfTwo(height);
      
      if (isPOT) {
        // Generate mipmaps for power-of-two textures
        gl.generateMipmap(gl.TEXTURE_2D);
        
        // Use mipmap filtering for better quality at different scales
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        
        // Try to enable anisotropic filtering if available
        this.tryEnableAnisotropicFiltering(gl);
      } else {
        // For non-power-of-two textures, use linear filtering without mipmaps
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      }
    }
    
    // Set wrapping to clamp to edge (standard for UI textures)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  /**
   * Check if a number is a power of two
   */
  private isPowerOfTwo(value: number): boolean {
    return value > 0 && (value & (value - 1)) === 0;
  }

  /**
   * Try to enable anisotropic filtering for better quality
   */
  private tryEnableAnisotropicFiltering(gl: WebGLRenderingContext | WebGL2RenderingContext): void {
    try {
      const ext = gl.getExtension('EXT_texture_filter_anisotropic');
      if (ext) {
        const maxAnisotropy = gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
        // Use moderate anisotropy (4x) for good quality/performance balance
        const anisotropy = Math.min(4, maxAnisotropy);
        gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, anisotropy);
      }
    } catch (error) {
      // Anisotropic filtering not available, continue without it
    }
  }

  /**
   * Upload ImageBitmap to WebGL texture with enhanced filtering
   */
  uploadImageBitmapToTexture(bitmap: ImageBitmap, texture?: WebGLTexture): WebGLTexture | null {
    if (!this.gl) return null;
    
    const gl = this.gl;
    const tex = texture || gl.createTexture();
    if (!tex) return null;
    
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei((gl as any).UNPACK_PREMULTIPLY_ALPHA_WEBGL ?? 0x8063, 0);
    
    // Upload the ImageBitmap directly
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bitmap);
    
    // Apply enhanced filtering
    this.setupTextureFiltering(gl, bitmap.width, bitmap.height);
    
    return tex;
  }

  // Phase 2: Initialize instanced rendering and atlas systems
  private initializeInstancedRendering(): void {
    if (!this.gl) return;
    
    try {
      // Initialize instanced renderer
      this.instancedRenderer = new InstancedRenderer(this.gl);
      if (this.instancedRenderer.init()) {
        this.instancedRenderingEnabled = true;
      } else {
        console.warn('Failed to initialize instanced renderer, falling back to individual draws');
        this.instancedRenderer = null;
      }
      
      // Initialize atlas manager
      this.atlasManager = new AtlasManager(this.gl, {
        maxAtlasSize: 1024,
        padding: 1,
        powerOfTwo: true
      });
    } catch (error) {
      console.warn('Failed to initialize instanced rendering:', error);
      this.instancedRenderingEnabled = false;
    }
  }

  /**
   * Initialize Phase 3 advanced texture management
   */
  private initializeAdvancedTextures(): void {
    if (!this.gl) return;
    
    try {
      // Check for anisotropic filtering support
      const ext = this.gl.getExtension('EXT_texture_filter_anisotropic');
      if (ext) {
        this.advancedTextures = new AdvancedTextureManager(this.gl);
        console.log('✅ Advanced texture management enabled');
      } else {
        console.log('ℹ️ Advanced texture management not available (no anisotropic filtering)');
      }
    } catch (error) {
      console.warn('Failed to initialize advanced textures:', error);
    }
  }

  /**
   * Get advanced texture capabilities and statistics
   */
  getAdvancedTextureInfo(): { 
    enabled: boolean; 
    anisotropyAvailable: boolean; 
    maxAnisotropy: number;
    memoryStats?: ReturnType<AdvancedTextureManager['getMemoryStats']>;
  } {
    if (!this.advancedTextures) {
      return {
        enabled: false,
        anisotropyAvailable: false,
        maxAnisotropy: 0
      };
    }

    const anisotropyInfo = this.advancedTextures.getAnisotropyInfo();
    return {
      enabled: true,
      anisotropyAvailable: anisotropyInfo.available,
      maxAnisotropy: anisotropyInfo.maxAnisotropy,
      memoryStats: this.advancedTextures.getMemoryStats()
    };
  }
  
  /**
   * Render sprites using instanced rendering when possible
   */
  renderInstancedSprites(sprites: Array<{
    assetKey: string;
    x: number;
    y: number;
    rotation?: number;
    scaleX?: number;
    scaleY?: number;
    tintR?: number;
    tintG?: number;
    tintB?: number;
    alpha?: number;
  }>): void {
    if (!this.instancedRenderingEnabled || !this.instancedRenderer || !this.atlasManager) {
      // Fallback to traditional rendering
      this.renderSpritesTraditional(sprites);
      return;
    }
    
    // Group sprites by atlas texture
    const batches = new Map<WebGLTexture, InstanceData[]>();
    
    for (const sprite of sprites) {
      // Ensure sprite is in atlas
      const entry = this.ensureSpriteInAtlas(sprite.assetKey);
      if (!entry) continue;
      
      const atlas = this.atlasManager.getAtlas('main');
      const texture = atlas.getTexture();
      if (!texture) continue;
      
      // Create instance data
      const instanceData: InstanceData = {
        x: sprite.x,
        y: sprite.y,
        rotation: sprite.rotation || 0,
        scaleX: sprite.scaleX || 1,
        scaleY: sprite.scaleY || 1,
        uvX: entry.uvX,
        uvY: entry.uvY,
        uvWidth: entry.uvWidth,
        uvHeight: entry.uvHeight,
        tintR: sprite.tintR || 1,
        tintG: sprite.tintG || 1,
        tintB: sprite.tintB || 1,
        alpha: sprite.alpha || 1
      };
      
      // Add to batch
      if (!batches.has(texture)) {
        batches.set(texture, []);
      }
      batches.get(texture)!.push(instanceData);
    }
    
    // Render each batch
    const projectionMatrix = this.createProjectionMatrix();
    for (const [texture, instances] of batches) {
      const batch: BatchRenderCall = {
        texture,
        instances,
        blendMode: 'normal'
      };
      this.instancedRenderer.renderBatch(batch, projectionMatrix);
    }
  }
  
  /**
   * Ensure a sprite is available in the atlas
   */
  private ensureSpriteInAtlas(assetKey: string): import("./assets/textureAtlas").AtlasEntry | null {
    if (!this.atlasManager) return null;
    
    const atlas = this.atlasManager.getAtlas('main');
    let entry = atlas.getEntry(assetKey);
    
    if (!entry) {
      // Need to rasterize and add to atlas
      const canvas = this.rasterizeAsset(assetKey);
      if (canvas) {
        entry = atlas.addEntry(assetKey, canvas);
      }
    }
    
    return entry;
  }
  
  /**
   * Rasterize an asset to canvas for atlas packing
   */
  private rasterizeAsset(assetKey: string): HTMLCanvasElement | null {
    // For now, use existing shape rasterization logic
    const shapes = (AssetsConfig as any).shapes2d || {};
    const shape: Shape2D | undefined = shapes[assetKey];
    
    const size = 64; // Standard sprite size
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    
    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.translate(size / 2, size / 2);
    const scale = size / 4;
    
    ctx.fillStyle = (AssetsConfig.palette && (AssetsConfig.palette as any).shipHull) || "#b0b7c3";
    
    // Basic vector draw covering circle, polygon and compound
    if (!shape) {
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(4, size * 0.12), 0, Math.PI * 2);
      ctx.fill();
    } else if ((shape as any).type === "circle") {
      const r = ((shape as any).r ?? 0.5) * scale;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
    } else if ((shape as any).type === "polygon") {
      const pts: number[][] = (shape as any).points || [];
      if (pts.length) {
        ctx.beginPath();
        ctx.moveTo((pts[0][0] || 0) * scale, (pts[0][1] || 0) * scale);
        for (let i = 1; i < pts.length; i++)
          ctx.lineTo((pts[i][0] || 0) * scale, (pts[i][1] || 0) * scale);
        ctx.closePath();
        ctx.fill();
      }
    } else if ((shape as any).type === "compound") {
      const parts = (shape as any).parts || [];
      for (const part of parts) {
        if ((part as any).type === "circle") {
          const r = ((part as any).r ?? 0.5) * scale;
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.fill();
        } else if ((part as any).type === "polygon") {
          const pts: number[][] = (part as any).points || [];
          if (pts.length) {
            ctx.beginPath();
            ctx.moveTo((pts[0][0] || 0) * scale, (pts[0][1] || 0) * scale);
            for (let i = 1; i < pts.length; i++)
              ctx.lineTo((pts[i][0] || 0) * scale, (pts[i][1] || 0) * scale);
            ctx.closePath();
            ctx.fill();
          }
        }
      }
    }
    
    ctx.restore();
    return canvas;
  }
  
  /**
   * Create projection matrix for current viewport
   */
  private createProjectionMatrix(): Float32Array {
    const width = this.canvas.width;
    const height = this.canvas.height;
    
    // Simple orthographic projection matrix
    const matrix = new Float32Array(16);
    
    // Orthographic projection: maps world coordinates to clip space [-1, 1]
    matrix[0] = 2 / width;    // X scale
    matrix[1] = 0;
    matrix[2] = 0;
    matrix[3] = 0;
    
    matrix[4] = 0;
    matrix[5] = -2 / height;  // Y scale (flip Y axis)
    matrix[6] = 0;
    matrix[7] = 0;
    
    matrix[8] = 0;
    matrix[9] = 0;
    matrix[10] = 1;
    matrix[11] = 0;
    
    matrix[12] = -1;          // X translation to center
    matrix[13] = 1;           // Y translation to center
    matrix[14] = 0;
    matrix[15] = 1;
    
    return matrix;
  }
  
  /**
   * Fallback rendering for sprites when instanced rendering is not available
   */
  private renderSpritesTraditional(sprites: Array<{
    assetKey: string;
    x: number;
    y: number;
    rotation?: number;
    scaleX?: number;
    scaleY?: number;
    tintR?: number;
    tintG?: number;
    tintB?: number;
    alpha?: number;
  }>): void {
    // Traditional individual sprite rendering
    // This would use the existing individual draw methods
    console.log(`Rendering ${sprites.length} sprites using traditional method`);
  }
  
  /**
   * Get instanced rendering statistics
   */
  getInstancedRenderingStats(): {
    enabled: boolean;
    atlasStats?: ReturnType<AtlasManager['getGlobalStats']>;
  } {
    return {
      enabled: this.instancedRenderingEnabled,
      atlasStats: this.atlasManager?.getGlobalStats()
    };
  }

  // Dispose all GL resources and clear caches
  dispose(): void {
    if (this.gl) {
      try {
        for (const key of Object.keys(this.shapeTextures)) {
          const tex = this.shapeTextures[key];
          if (!tex) continue;
          if (this.gameState) {
            try {
              const gl = this.gl as WebGLRenderingContext;
              releaseTexture(this.gameState, key, tex, (t) => {
                try {
                  gl.deleteTexture(t);
                } catch {}
              });
            } catch {}
          } else {
            try {
              (this.gl as WebGLRenderingContext).deleteTexture(tex);
            } catch {}
          }
        }
        // Optional resources cleanup
        try {
          if (this.quadVBO)
            (this.gl as WebGLRenderingContext).deleteBuffer(this.quadVBO);
        } catch {}
        try {
          if (this.quadProg)
            (this.gl as WebGLRenderingContext).deleteProgram(this.quadProg);
        } catch {}
        try {
          if (this.fboTex)
            (this.gl as WebGLRenderingContext).deleteTexture(this.fboTex);
        } catch {}
        try {
          if (this.fbo)
            (this.gl as WebGLRenderingContext).deleteFramebuffer(this.fbo);
        } catch {}
        // Remove starfield texture if present
        try {
          if ((this as any)._starfield)
            (this.gl as WebGLRenderingContext).deleteTexture(
              (this as any)._starfield,
            );
        } catch {}
        
        // Phase 2: Cleanup instanced rendering resources
        try {
          if (this.instancedRenderer) {
            this.instancedRenderer.dispose();
            this.instancedRenderer = null;
          }
        } catch {}
        try {
          if (this.atlasManager) {
            this.atlasManager.dispose();
            this.atlasManager = null;
          }
        } catch {}

        // Phase 3: Cleanup advanced texture management
        try {
          if (this.advancedTextures) {
            this.advancedTextures.dispose();
            this.advancedTextures = null;
          }
        } catch {}
      } catch {}
    }
    this.shapeTextures = {};
    this.quadVBO = null;
    this.quadProg = null;
    this.fbo = null;
    this.fboTex = null;
    (this as any)._starfield = null;
    this.gl = null;
  }

  // Internal: bake a simple 2D shape into a texture and cache it
  private bakeShapeToTexture(
    state: GameState | null,
    key: string,
    teamColor?: string,
  ): WebGLTexture | null {
    if (!this.gl) return null;
    const cacheKey = teamColor ? `${key}::${teamColor}` : key;
    if (this.shapeTextures[cacheKey]) return this.shapeTextures[cacheKey];
    try {
      const gl = this.gl as WebGLRenderingContext;
      const shapes = (AssetsConfig as any).shapes2d || {};
      const shape: Shape2D | undefined = shapes[key];
      // Offscreen rasterization canvas
      const size = 128;
      const cvs = document.createElement("canvas");
      cvs.width = size;
      cvs.height = size;
      const ctx = cvs.getContext("2d");
      if (!ctx) return null;
      ctx.clearRect(0, 0, size, size);
      ctx.save();
      ctx.translate(size / 2, size / 2);
      const scale = size / 4;
      // Use provided team color if present, otherwise fall back to palette
      ctx.fillStyle =
        teamColor ||
        (AssetsConfig.palette && (AssetsConfig.palette as any).shipHull) ||
        "#b0b7c3";
      // Basic vector draw covering circle, polygon and compound
      if (!shape) {
        ctx.beginPath();
        ctx.arc(0, 0, Math.max(4, size * 0.12), 0, Math.PI * 2);
        ctx.fill();
      } else if ((shape as any).type === "circle") {
        const r = ((shape as any).r ?? 0.5) * scale;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
      } else if ((shape as any).type === "polygon") {
        const pts: number[][] = (shape as any).points || [];
        if (pts.length) {
          ctx.beginPath();
          ctx.moveTo((pts[0][0] || 0) * scale, (pts[0][1] || 0) * scale);
          for (let i = 1; i < pts.length; i++)
            ctx.lineTo((pts[i][0] || 0) * scale, (pts[i][1] || 0) * scale);
          ctx.closePath();
          ctx.fill();
        }
      } else if ((shape as any).type === "compound") {
        const parts = (shape as any).parts || [];
        for (const part of parts) {
          if ((part as any).type === "circle") {
            const r = ((part as any).r ?? 0.5) * scale;
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.fill();
          } else if ((part as any).type === "polygon") {
            const pts: number[][] = (part as any).points || [];
            if (pts.length) {
              ctx.beginPath();
              ctx.moveTo((pts[0][0] || 0) * scale, (pts[0][1] || 0) * scale);
              for (let i = 1; i < pts.length; i++)
                ctx.lineTo((pts[i][0] || 0) * scale, (pts[i][1] || 0) * scale);
              ctx.closePath();
              ctx.fill();
            }
          }
        }
      }
      ctx.restore();

      // Create or acquire texture via pool when state is available
      const createTex = (): WebGLTexture => {
        const t = gl.createTexture()!;
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.pixelStorei((gl as any).UNPACK_PREMULTIPLY_ALPHA_WEBGL ?? 0x8063, 0);
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          cvs,
        );
        
        // Enhanced mipmapping support
        this.setupTextureFiltering(gl, cvs.width, cvs.height);
        
        return t;
      };

      let tex: WebGLTexture | null = null;
      if (state) {
        try {
          tex = acquireTexture(state, cacheKey, createTex);
        } catch {
          // Fallback to direct creation if pooling fails
          tex = createTex();
        }
      } else {
        tex = createTex();
      }
      if (!tex) return null;
      gl.bindTexture(gl.TEXTURE_2D, tex);

      this.shapeTextures[cacheKey] = tex;
      return tex;
    } catch {
      return null;
    }
  }

  // Optional future path: draw a textured quad (not used in tests yet)
  // Keeping a stub to document intent and ease future extension.
  // private drawTexturedQuad(_tex: WebGLTexture, _x: number, _y: number, _w: number, _h: number): void {
  //   // Intentionally empty in minimal stub
  // }
}

export default WebGLRenderer;
