// src/webglrenderer.ts - Minimal WebGL renderer stub ported from webglRenderer.js
// Provides a typed, minimal WebGL renderer so the rest of the app can opt-in.

import { AssetsConfig, getShipAsset, getTurretAsset, getVisualConfig } from './config/assets/assetsConfig';
import { TeamsConfig } from './config/teamsConfig';
import { shieldFlashes, healthFlashes } from './gamemanager';
import { getDefaultShipType } from './config/entitiesConfig';
import { RendererConfig } from './config/rendererConfig';

export class WebGLRenderer {
  // Fullscreen quad shader for blitting FBO to main canvas
  private quadProg: WebGLProgram | null = null;
  private quadVBO: WebGLBuffer | null = null;
  private quadLoc_pos: number = -1;
  private quadLoc_tex: WebGLUniformLocation | null = null;
  // Offscreen framebuffer and texture for buffer rendering
  private fbo: WebGLFramebuffer | null = null;
  private fboTexture: WebGLTexture | null = null;
  private _fboWidth: number = 0;
  private _fboHeight: number = 0;

  // Public accessors for tests/consumers (read-only)
  public get fboWidth(): number { return this._fboWidth; }
  public get fboHeight(): number { return this._fboHeight; }
  canvas: HTMLCanvasElement;
  gl: WebGL2RenderingContext | WebGLRenderingContext | null = null;
  // simple GL program state for point rendering
  private prog: WebGLProgram | null = null;
  private attribLoc_pos: number = -1;
  private attribLoc_size: number = -1;
  private attribLoc_color: number = -1;
  private vertexBuffer: WebGLBuffer | null = null;
  providesOwnLoop = false;
  type = 'webgl';
  pixelRatio = 1;
  // textured quad shader for rendering baked asset textures
  private texProg: WebGLProgram | null = null;
  private texVBO: WebGLBuffer | null = null;
  private texAttrib_pos: number = -1;
  private texAttrib_uv: number = -1;
  private texLoc_tex: WebGLUniformLocation | null = null;
  // map of shape keys to GL textures
  private shapeTextures: Record<string, WebGLTexture | null> = {};
  private shapeCanvasSize: number = 64;

  // Public helpers to inspect the baked texture cache in tests or callers
  public hasCachedTexture(key: string): boolean {
    return !!this.shapeTextures[key];
  }

  public getCachedTexture(key: string): WebGLTexture | null {
    return this.shapeTextures[key] || null;
  }

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  // FBO will be created in init or on first render
  }

  init(): boolean {
      // Create fullscreen quad shader for blitting FBO
      try {
        const gl = this.gl as WebGLRenderingContext;
        const vsQuad = `attribute vec2 a_pos; varying vec2 v_tex; void main(){ v_tex = (a_pos+1.0)*0.5; gl_Position = vec4(a_pos,0,1); }`;
        const fsQuad = `precision mediump float; varying vec2 v_tex; uniform sampler2D u_tex; void main(){ gl_FragColor = texture2D(u_tex, v_tex); }`;
        const compile = (src: string, type: number) => { const s = gl.createShader(type as any)!; gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { const info = gl.getShaderInfoLog(s); gl.deleteShader(s); throw new Error('Shader compile error: ' + info); } return s; };
        const vsObj = compile(vsQuad, gl.VERTEX_SHADER);
        const fsObj = compile(fsQuad, gl.FRAGMENT_SHADER);
        const prog = gl.createProgram()!;
        gl.attachShader(prog, vsObj); gl.attachShader(prog, fsObj); gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { throw new Error('Program link error: ' + gl.getProgramInfoLog(prog)); }
        this.quadProg = prog;
        this.quadLoc_pos = gl.getAttribLocation(prog, 'a_pos');
        this.quadLoc_tex = gl.getUniformLocation(prog, 'u_tex');
        // Create VBO for fullscreen quad
        this.quadVBO = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVBO);
        // Vertices: two triangles covering clip space
        const quadVerts = new Float32Array([
          -1, -1,  1, -1,  -1, 1,
           1, -1,  1, 1,  -1, 1
        ]);
        gl.bufferData(gl.ARRAY_BUFFER, quadVerts, gl.STATIC_DRAW);
      } catch (e) { this.quadProg = null; }
    // Create textured-quad shader for drawing baked asset textures
    try {
      const gl = this.gl as WebGLRenderingContext;
      const vs = `attribute vec2 a_pos; attribute vec2 a_uv; varying vec2 v_uv; void main(){ v_uv = a_uv; gl_Position = vec4(a_pos, 0.0, 1.0); }`;
      const fs = `precision mediump float; varying vec2 v_uv; uniform sampler2D u_tex; void main(){ gl_FragColor = texture2D(u_tex, v_uv); }`;
      const compile = (src: string, type: number) => { const s = gl.createShader(type as any)!; gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { const info = gl.getShaderInfoLog(s); gl.deleteShader(s); throw new Error('Shader compile error: ' + info); } return s; };
      const vsObj = compile(vs, gl.VERTEX_SHADER);
      const fsObj = compile(fs, gl.FRAGMENT_SHADER);
      const prog = gl.createProgram()!;
      gl.attachShader(prog, vsObj); gl.attachShader(prog, fsObj); gl.linkProgram(prog);
      if (gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        this.texProg = prog;
        this.texAttrib_pos = gl.getAttribLocation(prog, 'a_pos');
        this.texAttrib_uv = gl.getAttribLocation(prog, 'a_uv');
        this.texLoc_tex = gl.getUniformLocation(prog, 'u_tex');
        this.texVBO = gl.createBuffer();
      } else {
        this.texProg = null;
      }
    } catch (e) { this.texProg = null; }
    try {
      // Prefer WebGL2, fall back to WebGL1
      this.gl = this.canvas.getContext('webgl2') as WebGL2RenderingContext | null;
      if (!this.gl) {
        this.gl = (this.canvas.getContext('webgl') || this.canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
        if (!this.gl) return false;
      }
      const gl = this.gl as WebGLRenderingContext;
      // Create offscreen framebuffer and texture at logical size × renderer scale
  const LOGICAL_W = 1920, LOGICAL_H = 1080;
  const renderScale = (RendererConfig && typeof (RendererConfig.renderScale) === 'number') ? RendererConfig.renderScale : 1;
  const bufferW = Math.round(LOGICAL_W * renderScale);
  const bufferH = Math.round(LOGICAL_H * renderScale);
      // Create texture for FBO
      this.fboTexture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.fboTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, bufferW, bufferH, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      // Create framebuffer
      this.fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.fboTexture, 0);
  this._fboWidth = bufferW;
  this._fboHeight = bufferH;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      // set background from Assets palette.background when possible
      try {
        const bg = ((AssetsConfig.palette as any).background || '#0b1220').replace('#','');
        const bigint = parseInt(bg.length===3? bg.split('').map((c:string)=>c+c).join(''): bg,16);
        const r = ((bigint >> 16) & 255)/255; const g = ((bigint >> 8) & 255)/255; const b = (bigint & 255)/255;
        gl.clearColor(r, g, b, 1.0);
      } catch { gl.clearColor(0.02, 0.03, 0.06, 1.0); }
      // enable alpha blending for overlays
      try { gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); } catch (e) {}
      // compute pixelRatio to map logical (CSS) pixels to backing-store pixels
      try {
        const cssW = this.canvas.clientWidth || this.canvas.width || 1;
        this.pixelRatio = (this.canvas.width || cssW) / cssW;
      } catch (e) { this.pixelRatio = 1; }

      // prepare a tiny GL program for drawing colored points representing ships
      try {
        const vs = `attribute vec2 a_pos; attribute float a_size; attribute vec4 a_color; varying vec4 v_color; void main(){ v_color=a_color; gl_Position = vec4(a_pos, 0.0, 1.0); gl_PointSize = a_size; }`;
        const fs = `precision mediump float; varying vec4 v_color; void main(){ vec2 c = gl_PointCoord - vec2(0.5); if(length(c) > 0.5) discard; gl_FragColor = v_color; }`;
        const compile = (src: string, type: number) => { const s = gl.createShader(type as any)!; gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { const info = gl.getShaderInfoLog(s); gl.deleteShader(s); throw new Error('Shader compile error: ' + info); } return s; };
        const vsObj = compile(vs, gl.VERTEX_SHADER);
        const fsObj = compile(fs, gl.FRAGMENT_SHADER);
        const prog = gl.createProgram()!;
        gl.attachShader(prog, vsObj); gl.attachShader(prog, fsObj); gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { throw new Error('Program link error: ' + gl.getProgramInfoLog(prog)); }
        this.prog = prog;
        this.attribLoc_pos = gl.getAttribLocation(prog, 'a_pos');
        this.attribLoc_size = gl.getAttribLocation(prog, 'a_size');
        this.attribLoc_color = gl.getAttribLocation(prog, 'a_color');
        this.vertexBuffer = gl.createBuffer();
      } catch (e) {
        // leave program null if shader compilation fails (fallback to minimal clear)
        this.prog = null;
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  // Called when backing-store size (canvas.width/height) changes so
  // the renderer can update internal scaling/viewport without a full re-init.
  updateScale(): void {
    if (!this.gl) return;
    try {
      const cssW = this.canvas.clientWidth || Math.round((this.canvas.width || 1) / (this.pixelRatio || 1));
      this.pixelRatio = (this.canvas.width || cssW) / Math.max(1, cssW);
      // set viewport in logical/backing pixels on next render
      // TODO: Resize FBO if needed
    } catch (e) { /* ignore */ }
  }

  isRunning(): boolean { return false; }

  renderState(state: import('./types').GameState, interpolation = 0): void {
    // --- Ensure FBO is always resized to 1920x1080 × renderScale before any drawing ---
    if (!this.gl) return;
    const gl = this.gl as WebGLRenderingContext;
  const LOGICAL_W = 1920, LOGICAL_H = 1080;
  const renderScale = (RendererConfig && typeof (RendererConfig.renderScale) === 'number') ? RendererConfig.renderScale : 1;
  const bufferW = Math.round(LOGICAL_W * renderScale);
  const bufferH = Math.round(LOGICAL_H * renderScale);
  // If FBO size changed, recreate FBO and texture
  if (this.fboWidth !== bufferW || this.fboHeight !== bufferH) {
      // Delete old FBO/texture if present
      if (this.fboTexture) gl.deleteTexture(this.fboTexture);
      if (this.fbo) gl.deleteFramebuffer(this.fbo);
      // Create new texture for FBO
      this.fboTexture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.fboTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, bufferW, bufferH, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      // Create new framebuffer
      this.fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.fboTexture, 0);
  this._fboWidth = bufferW;
  this._fboHeight = bufferH;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    // --- Render simulation to offscreen framebuffer ---
    if (this.fbo && this.fboTexture) {
  gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
  gl.viewport(0, 0, bufferW, bufferH);
  gl.clear(gl.COLOR_BUFFER_BIT);
        // If we have a simple GL program, draw ships as round points with simple overlays
        if (this.prog && this.vertexBuffer) {
          try {
            // ...existing vertex packing and draw logic, but use fboWidth/fboHeight for logical size...
            const w = bufferW;
            const h = bufferH;
            const ships = state.ships || [];
            const verts: number[] = [];
            const now = (state && state.t) || 0;
            for (const s of ships) {
              const x = (s.x || 0);
              const y = (s.y || 0);
              const clipX = (x / Math.max(1, LOGICAL_W)) * 2 - 1;
              const clipY = 1 - (y / Math.max(1, LOGICAL_H)) * 2;
              const radius = s.radius || 6;
              const ps = Math.max(2, radius * 2);
              const teamObj = (s.team === 'blue') ? TeamsConfig.teams.blue : TeamsConfig.teams.red;
              const colorHex = (teamObj && teamObj.color) || AssetsConfig.palette.shipHull || '#888';
              const hexToRgba = (hex: string) => {
                const h = hex.replace('#',''); const bigint = parseInt(h.length===3? h.split('').map(c=>c+c).join(''): h,16);
                const r = ((bigint >> 16) & 255)/255; const g = ((bigint >> 8) & 255)/255; const b = (bigint & 255)/255; return [r,g,b,1];
              };
              const baseColor = hexToRgba(colorHex);

              // Try to draw a baked asset texture for the ship if available
              try {
                const shipAssetKey = (s.type || getDefaultShipType());
                const shipTex = this.bakeShapeToTexture(shipAssetKey);
                if (shipTex && this.texProg) {
                  // compute quad size in clip-space
                  const quadW = (radius * 2) / Math.max(1, w) * 2; // map px->clip
                  const quadH = (radius * 2) / Math.max(1, h) * 2;
                  this.drawTexturedQuad(shipTex, clipX, clipY, quadW, quadH);
                  // continue to next ship (skip point draw)
                  continue;
                }
              } catch (e) {}

              // Ship hull (fallback to point draw)
              verts.push(clipX, clipY, ps, baseColor[0], baseColor[1], baseColor[2], baseColor[3]);

              // Engine trail (simple: draw faded points for trail)
              if (Array.isArray(s.trail)) {
                for (let i = 0; i < s.trail.length; i++) {
                  const tx = s.trail[i].x || 0;
                  const ty = s.trail[i].y || 0;
                  const tClipX = (tx / Math.max(1, LOGICAL_W)) * 2 - 1;
                  const tClipY = 1 - (ty / Math.max(1, LOGICAL_H)) * 2;
                  const tAlpha = 0.2 + 0.5 * (i / s.trail.length);
                  verts.push(tClipX, tClipY, Math.max(2, radius), 0.7, 0.7, 1.0, tAlpha);
                }
              }

              // Shield effect (draw a blue ring if shield is up). Prefer shaderless textured ring if available
              if (s.shield > 0) {
                try {
                  const shKey = 'shieldRing';
                  const shTex = this.bakeShapeToTexture(shKey);
                  if (shTex && this.texProg) {
                    const quadW = (radius * 2.4) / Math.max(1, w) * 2;
                    const quadH = (radius * 2.4) / Math.max(1, h) * 2;
                    this.drawTexturedQuad(shTex, clipX, clipY, quadW, quadH);
                  } else {
                    verts.push(clipX, clipY, ps * 1.2, 0.3, 0.7, 1.0, 0.5);
  /**
   * Dispose all GL resources and cached textures. Call on shutdown/reset.
   */
  dispose(): void {
    if (!this.gl) return;
    const gl = this.gl as WebGLRenderingContext;
    // Delete all cached shape textures
    for (const key in this.shapeTextures) {
      const tex = this.shapeTextures[key];
      if (tex) gl.deleteTexture(tex);
      this.shapeTextures[key] = null;
    }
    // Delete FBO and its texture
    if (this.fboTexture) gl.deleteTexture(this.fboTexture);
    if (this.fbo) gl.deleteFramebuffer(this.fbo);
    this.fboTexture = null;
    this.fbo = null;
    // Delete GL buffers
    if (this.vertexBuffer) gl.deleteBuffer(this.vertexBuffer);
    if (this.quadVBO) gl.deleteBuffer(this.quadVBO);
    if (this.texVBO) gl.deleteBuffer(this.texVBO);
    this.vertexBuffer = null;
    this.quadVBO = null;
    this.texVBO = null;
    // Delete GL programs
    if (this.prog) gl.deleteProgram(this.prog);
    if (this.quadProg) gl.deleteProgram(this.quadProg);
    if (this.texProg) gl.deleteProgram(this.texProg);
    this.prog = null;
    this.quadProg = null;
    this.texProg = null;
    // Clear other references
    this.shapeTextures = {};
    this.gl = null;
  }
}

                } catch (e) { verts.push(clipX, clipY, ps * 1.2, 0.3, 0.7, 1.0, 0.5); }
              }

              // Health/damage flash (draw a reddish ring if recent damage)
              if (Array.isArray(healthFlashes)) {
                const flash = healthFlashes.find(f => f.id === s.id);
                if (flash && flash.ttl > 0) {
                  verts.push(clipX, clipY, ps * 1.3, 1.0, 0.3, 0.3, 0.7);
                }
              }
            }
            // upload buffer and draw
            const floatArr = new Float32Array(verts);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, floatArr, gl.DYNAMIC_DRAW);
            gl.useProgram(this.prog as WebGLProgram);
            const stride = 7 * 4; // 7 floats per vertex
            gl.enableVertexAttribArray(this.attribLoc_pos);
            gl.vertexAttribPointer(this.attribLoc_pos, 2, gl.FLOAT, false, stride, 0);
            gl.enableVertexAttribArray(this.attribLoc_size);
            gl.vertexAttribPointer(this.attribLoc_size, 1, gl.FLOAT, false, stride, 2 * 4);
            gl.enableVertexAttribArray(this.attribLoc_color);
            gl.vertexAttribPointer(this.attribLoc_color, 4, gl.FLOAT, false, stride, 3 * 4);
            const count = Math.floor(floatArr.length / 7);
            gl.drawArrays(gl.POINTS, 0, count);
          } catch (e) {}
  /**
   * Preload all asset textures at startup/reset.
   */
  preloadAllAssets(): void {
    if (!this.gl) return;
    const shapes = (AssetsConfig as any).shapes2d || {};
    for (const key of Object.keys(shapes)) {
      this.bakeShapeToTexture(key);
    }
  }
}

      // Draw bullets using baked textures if available
      try {
        const shapes = (AssetsConfig as any).shapes2d || {};
        for (const b of state.bullets || []) {
          try {
            const bx = (b.x || 0);
            const by = (b.y || 0);
            const clipX = (bx / Math.max(1, LOGICAL_W)) * 2 - 1;
            const clipY = 1 - (by / Math.max(1, LOGICAL_H)) * 2;
            const r = b.radius || b.bulletRadius || 1.5;
            const kind = b.kind || 'bullet';
            const assetKey = `bullet_${kind}`;
            const tex = this.bakeShapeToTexture(assetKey) || this.bakeShapeToTexture('bullet') || this.bakeShapeToTexture('particleSmall');
            if (tex && this.texProg) {
              const quadW = (r * 2) / Math.max(1, this.fboWidth) * 2;
              const quadH = (r * 2) / Math.max(1, this.fboHeight) * 2;
              this.drawTexturedQuad(tex, clipX, clipY, quadW, quadH);
              continue;
            }
            // fallback: draw as point
            // reuse vertex buffer path by pushing temporary verts
            const clipSize = Math.max(1, r * 2);
            const color = (AssetsConfig.palette && AssetsConfig.palette.bullet) || '#fff';
            const hexToRgba = (hex: string) => { const h = hex.replace('#',''); const bigint = parseInt(h.length===3? h.split('').map(c=>c+c).join(''): h,16); const rr = ((bigint >> 16) & 255)/255; const gg = ((bigint >> 8) & 255)/255; const bcol = (bigint & 255)/255; return [rr,gg,bcol,1]; };
            // pack into immediate draw via prog path: push 1 vertex and draw
            const floatArr = new Float32Array([clipX, clipY, clipSize, 1,1,1,1]);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, floatArr, gl.DYNAMIC_DRAW);
            gl.useProgram(this.prog as WebGLProgram);
            const stride = 7 * 4;
            gl.enableVertexAttribArray(this.attribLoc_pos);
            gl.vertexAttribPointer(this.attribLoc_pos, 2, gl.FLOAT, false, stride, 0);
            gl.enableVertexAttribArray(this.attribLoc_size);
            gl.vertexAttribPointer(this.attribLoc_size, 1, gl.FLOAT, false, stride, 2 * 4);
            gl.enableVertexAttribArray(this.attribLoc_color);
            gl.vertexAttribPointer(this.attribLoc_color, 4, gl.FLOAT, false, stride, 3 * 4);
            gl.drawArrays(gl.POINTS, 0, 1);
          } catch (e) {}
        }
      } catch (e) {}

      // Draw particles and explosions from state using baked textures if possible
      try {
        for (const p of state.particles || []) {
          try {
            const px = (p.x || 0); const py = (p.y || 0);
            const clipX = (px / Math.max(1, LOGICAL_W)) * 2 - 1;
            const clipY = 1 - (py / Math.max(1, LOGICAL_H)) * 2;
            const size = (p.r || 2);
            const shapeKey = p.assetShape || (p.r > 0.5 ? 'particleMedium' : 'particleSmall');
            const tex = this.bakeShapeToTexture(shapeKey) || this.bakeShapeToTexture('particleSmall');
            if (tex && this.texProg) {
              const quadW = (size * 2) / Math.max(1, this.fboWidth) * 2;
              const quadH = (size * 2) / Math.max(1, this.fboHeight) * 2;
              this.drawTexturedQuad(tex, clipX, clipY, quadW, quadH);
            }
          } catch (e) {}
        }
      } catch (e) {}

      try {
        for (const ex of state.explosions || []) {
          try {
            const exx = (ex.x || 0); const exy = (ex.y || 0);
            const clipX = (exx / Math.max(1, LOGICAL_W)) * 2 - 1;
            const clipY = 1 - (exy / Math.max(1, LOGICAL_H)) * 2;
            const tex = this.bakeShapeToTexture('explosionParticle') || null;
            const s = ex.scale || 1;
            if (tex && this.texProg) {
              const wq = (12 * s) / Math.max(1, this.fboWidth) * 2; const hq = (12 * s) / Math.max(1, this.fboHeight) * 2;
              this.drawTexturedQuad(tex, clipX, clipY, wq, hq);
            } else {
              // fallback: very simple gl point
              const floatArr = new Float32Array([clipX, clipY, Math.max(2, 12*s), 1,1,0.8,1]);
              gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
              gl.bufferData(gl.ARRAY_BUFFER, floatArr, gl.DYNAMIC_DRAW);
              gl.useProgram(this.prog as WebGLProgram);
              const stride = 7 * 4;
              gl.enableVertexAttribArray(this.attribLoc_pos);
              gl.vertexAttribPointer(this.attribLoc_pos, 2, gl.FLOAT, false, stride, 0);
              gl.enableVertexAttribArray(this.attribLoc_size);
              gl.vertexAttribPointer(this.attribLoc_size, 1, gl.FLOAT, false, stride, 2 * 4);
              gl.enableVertexAttribArray(this.attribLoc_color);
              gl.vertexAttribPointer(this.attribLoc_color, 4, gl.FLOAT, false, stride, 3 * 4);
              gl.drawArrays(gl.POINTS, 0, 1);
            }
          } catch (e) {}
        }
      } catch (e) {}
    }
    // --- Blit/copy FBO to main canvas with fit-to-window scaling ---
    if (this.fboTexture && this.quadProg && this.quadVBO && this.gl) {
      const displayScale = (RendererConfig && typeof (RendererConfig.displayScale) === 'number') ? RendererConfig.displayScale : 1;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      // Set viewport to canvas size, scaled by displayScale
      gl.viewport(0, 0, Math.round(this.canvas.width * displayScale), Math.round(this.canvas.height * displayScale));
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(this.quadProg);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.fboTexture);
      if (this.quadLoc_tex) gl.uniform1i(this.quadLoc_tex, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVBO);
      gl.enableVertexAttribArray(this.quadLoc_pos);
      gl.vertexAttribPointer(this.quadLoc_pos, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.disableVertexAttribArray(this.quadLoc_pos);
    }
    // --- End simulation rendering and buffer copy ---
    // No redundant resizing or copying; buffer is always correct size before drawing, and copy happens once after drawing.
    // Swallow outer render errors
    try {} catch (e) {}
  }

  // Bake a 2D asset shape into a canvas and upload to a GL texture (cached)
  private bakeShapeToTexture(key: string): WebGLTexture | null {
    if (!this.gl) return null;
    if (this.shapeTextures[key]) return this.shapeTextures[key];
    try {
      const gl = this.gl as WebGLRenderingContext;
      const shapes = (AssetsConfig as any).shapes2d || {};
      const shape = shapes[key];
      const size = this.shapeCanvasSize;
      const cvs = document.createElement('canvas'); cvs.width = size; cvs.height = size;
      const ctx2 = cvs.getContext('2d')!;
      ctx2.clearRect(0,0,size,size);
      // draw centered at size/2, size/2 with scale
      ctx2.translate(size/2, size/2);
      const scale = size/4; // heuristic: asset units map to scale
      ctx2.fillStyle = (AssetsConfig.palette && (AssetsConfig.palette.shipHull)) || '#eee';
      if (!shape) {
        // fallback circle
        ctx2.beginPath(); ctx2.arc(0,0,Math.max(4,size*0.12),0,Math.PI*2); ctx2.fill();
      } else if (shape.type === 'circle') {
        ctx2.beginPath(); ctx2.arc(0,0,(shape.r || 0.5)*scale,0,Math.PI*2); ctx2.fill();
      } else if (shape.type === 'polygon') {
        const pts = shape.points || [] as number[][];
        if (pts.length) {
          ctx2.beginPath(); ctx2.moveTo((pts[0][0]||0)*scale,(pts[0][1]||0)*scale);
          for (let i=1;i<pts.length;i++) ctx2.lineTo((pts[i][0]||0)*scale,(pts[i][1]||0)*scale);
          ctx2.closePath(); ctx2.fill();
        }
      } else if (shape.type === 'compound') {
        for (const part of shape.parts || []) {
          if (part.type === 'circle') { ctx2.beginPath(); ctx2.arc(0,0,(part.r||0.5)*scale,0,Math.PI*2); ctx2.fill(); }
          else if (part.type === 'polygon') { const pts = part.points || []; if (pts.length) { ctx2.beginPath(); ctx2.moveTo((pts[0][0]||0)*scale,(pts[0][1]||0)*scale); for (let i=1;i<pts.length;i++) ctx2.lineTo((pts[i][0]||0)*scale,(pts[i][1]||0)*scale); ctx2.closePath(); ctx2.fill(); } }
        }
      }
      // upload to GL texture
      const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cvs);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      this.shapeTextures[key] = tex;
      return tex;
    } catch (e) { return null; }
  }

  // Draw a textured quad at clip-space coordinates [-1..1] using the baked texture
  private drawTexturedQuad(tex: WebGLTexture | null, clipX: number, clipY: number, clipW: number, clipH: number) {
    if (!this.gl || !this.texProg || !tex) return;
    try {
      const gl = this.gl as WebGLRenderingContext;
      gl.useProgram(this.texProg as WebGLProgram);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex);
      if (this.texLoc_tex) gl.uniform1i(this.texLoc_tex, 0);
      // Build two-triangle VBO with pos/uv
      const x1 = clipX - clipW/2; const x2 = clipX + clipW/2;
      const y1 = clipY - clipH/2; const y2 = clipY + clipH/2;
      // vertex format: posX,posY, u,v
      const verts = new Float32Array([
        x1,y1, 0,0,
        x2,y1, 1,0,
        x1,y2, 0,1,
        x2,y1, 1,0,
        x2,y2, 1,1,
        x1,y2, 0,1
      ]);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.texVBO);
      gl.bufferData(gl.ARRAY_BUFFER, verts, gl.DYNAMIC_DRAW);
      const stride = 4 * 4; // 4 floats per vertex
      gl.enableVertexAttribArray(this.texAttrib_pos);
      gl.vertexAttribPointer(this.texAttrib_pos, 2, gl.FLOAT, false, stride, 0);
      gl.enableVertexAttribArray(this.texAttrib_uv);
      gl.vertexAttribPointer(this.texAttrib_uv, 2, gl.FLOAT, false, stride, 2 * 4);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.disableVertexAttribArray(this.texAttrib_pos);
      gl.disableVertexAttribArray(this.texAttrib_uv);
    } catch (e) {}
  }
}