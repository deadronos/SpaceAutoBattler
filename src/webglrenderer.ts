// Minimal, typed WebGL renderer focused on texture baking and lifecycle
// Implements the public API expected by main.ts and tests.

import { AssetsConfig, Shape2D } from "./config/assets/assetsConfig";
import type { GameState } from "./types";
import {
  acquireTexture,
  releaseTexture,
  acquireSprite,
  releaseSprite,
  acquireEffect,
  releaseEffect,
  makePooled,
  createExplosionEffect,
  resetExplosionEffect,
  ExplosionEffect,
} from "./entities";

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
      // Lazily initialize optional programs/buffers when used
      return true;
    } catch {
      return false;
    }
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
    const gl = this.gl;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT);
    try {
      const ships = (state && state.ships) || [];
      for (const s of ships) {
        const type = (s && s.type) || "fighter";
        this.bakeShapeToTexture(state, type);
        // Acquire a transient sprite object for this ship and rehydrate it.
        try {
          const key = `ship:${type}`;
          const sprite = acquireSprite(this.gameState || (state as any), key, () => ({ type }));
          // Reset/rehydrate runtime fields used by renderer
          type RenderSprite = { type: string; x?: number; y?: number; angle?: number };
          const sp = sprite as unknown as RenderSprite;
          try {
            sp.x = s.x || 0;
            sp.y = s.y || 0;
            sp.angle = s.angle || 0;
          } catch {}
          try { releaseSprite(this.gameState || (state as any), key, sprite); } catch {}
        } catch {}
      }
      // Process visual flashes/effects and use effect pooling for transient objects
      try {
        const flashes = (state as any).flashes || [];
        for (const f of flashes) {
          try {
            const key = `flash`;
            const pooled = acquireEffect(this.gameState || (state as any), key, () => makePooled(
              createExplosionEffect({ x: f.x || 0, y: f.y || 0 }),
              (obj, initArgs) => {
                resetExplosionEffect(obj, initArgs as any);
                // attach render-only fields
                (obj as any).ttl = initArgs?.ttl ?? 0.5;
              }
            ), f);
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
            try { releaseEffect(this.gameState || (state as any), key, pooled); } catch {}
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
      for (const key of Object.keys(shapes)) this.bakeShapeToTexture(this.gameState, key);
    } catch {}
  }

  // Testing helper: check if we have a cached texture for a key
  hasCachedTexture(key: string): boolean {
    return !!this.shapeTextures[key];
  }

  // Dispose all GL resources and clear caches
  dispose(): void {
    if (this.gl) {
      try {
        for (const key of Object.keys(this.shapeTextures)) {
          const tex = this.shapeTextures[key];
          if (!tex) continue;
          if (this.gameState) {
            // Return texture to pool for reuse; allow pool to dispose overflow via deleter
            try {
              const gl = this.gl as WebGLRenderingContext;
              releaseTexture(this.gameState, key, tex, (t) => { try { gl.deleteTexture(t); } catch {} });
            } catch {}
          } else {
            // No pool available, delete GL resource
            try { (this.gl as WebGLRenderingContext).deleteTexture(tex); } catch {}
          }
        }
        // Optional resources cleanup
        try { if (this.quadVBO) (this.gl as WebGLRenderingContext).deleteBuffer(this.quadVBO); } catch {}
        try { if (this.quadProg) (this.gl as WebGLRenderingContext).deleteProgram(this.quadProg); } catch {}
        try { if (this.fboTex) (this.gl as WebGLRenderingContext).deleteTexture(this.fboTex); } catch {}
        try { if (this.fbo) (this.gl as WebGLRenderingContext).deleteFramebuffer(this.fbo); } catch {}
      } catch {}
    }
    this.shapeTextures = {};
    this.quadVBO = null;
    this.quadProg = null;
    this.fbo = null;
    this.fboTex = null;
    this.gl = null;
  }

  // Internal: bake a simple 2D shape into a texture and cache it
  private bakeShapeToTexture(state: GameState | null, key: string): WebGLTexture | null {
    if (!this.gl) return null;
    if (this.shapeTextures[key]) return this.shapeTextures[key];
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

      // Create or acquire texture via pool when state is available
      const createTex = (): WebGLTexture => {
        const t = gl.createTexture()!;
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.pixelStorei((gl as any).UNPACK_PREMULTIPLY_ALPHA_WEBGL ?? 0x8063, 0);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cvs);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        return t;
      };

      let tex: WebGLTexture | null = null;
      if (state) {
        try {
          tex = acquireTexture(state, key, createTex);
        } catch {
          // Fallback to direct creation if pooling fails
          tex = createTex();
        }
      } else {
        tex = createTex();
      }
      if (!tex) return null;
      gl.bindTexture(gl.TEXTURE_2D, tex);

      this.shapeTextures[key] = tex;
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
