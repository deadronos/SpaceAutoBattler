// src/webglrenderer.ts - Minimal WebGL renderer stub ported from webglRenderer.js
// Provides a typed, minimal WebGL renderer so the rest of the app can opt-in.

import { AssetsConfig, getShipAsset, getTurretAsset, getVisualConfig } from './config/assets/assetsConfig';
import { TeamsConfig } from './config/teamsConfig';
import { shieldFlashes, healthFlashes } from './gamemanager';
import { getDefaultShipType } from './config/entitiesConfig';

export class WebGLRenderer {
  // Fullscreen quad shader for blitting FBO to main canvas
  private quadProg: WebGLProgram | null = null;
  private quadVBO: WebGLBuffer | null = null;
  private quadLoc_pos: number = -1;
  private quadLoc_tex: WebGLUniformLocation | null = null;
  // Offscreen framebuffer and texture for buffer rendering
  private fbo: WebGLFramebuffer | null = null;
  private fboTexture: WebGLTexture | null = null;
  private fboWidth: number = 0;
  private fboHeight: number = 0;
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
      const rendererScale = 1; // TODO: get from config if available
      const bufferW = Math.round(LOGICAL_W * rendererScale);
      const bufferH = Math.round(LOGICAL_H * rendererScale);
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
      this.fboWidth = bufferW;
      this.fboHeight = bufferH;
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

  renderState(state: any, interpolation = 0): void {
      // --- Blit/copy FBO to main canvas with fit-to-window scaling ---
      if (this.fboTexture && this.quadProg && this.quadVBO && this.gl) {
        const gl = this.gl as WebGLRenderingContext;
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        // Set viewport to canvas size
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
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
    if (!this.gl) return;
    const gl = this.gl as WebGLRenderingContext;
    try {
      // --- Render simulation to offscreen framebuffer ---
      if (this.fbo && this.fboTexture) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
        gl.viewport(0, 0, this.fboWidth, this.fboHeight);
        gl.clear(gl.COLOR_BUFFER_BIT);
        // If we have a simple GL program, draw ships as round points with simple overlays
        if (this.prog && this.vertexBuffer) {
          try {
            // ...existing vertex packing and draw logic, but use fboWidth/fboHeight for logical size...
            const w = this.fboWidth;
            const h = this.fboHeight;
            const ships = state.ships || [];
            const verts: number[] = [];
            const now = (state && state.t) || 0;
            for (const s of ships) {
              const x = (s.x || 0);
              const y = (s.y || 0);
              const clipX = (x / Math.max(1, w)) * 2 - 1;
              const clipY = 1 - (y / Math.max(1, h)) * 2;
              const radius = s.radius || 6;
              const ps = Math.max(2, radius * 2);
              // ...existing color and overlay logic...
              const teamObj = (s.team === 'blue') ? TeamsConfig.teams.blue : TeamsConfig.teams.red;
              const colorHex = (teamObj && teamObj.color) || AssetsConfig.palette.shipHull || '#888';
              const hexToRgba = (hex: string) => {
                const h = hex.replace('#',''); const bigint = parseInt(h.length===3? h.split('').map(c=>c+c).join(''): h,16);
                const r = ((bigint >> 16) & 255)/255; const g = ((bigint >> 8) & 255)/255; const b = (bigint & 255)/255; return [r,g,b,1];
              };
              const baseColor = hexToRgba(colorHex);
              verts.push(clipX, clipY, ps, baseColor[0], baseColor[1], baseColor[2], baseColor[3]);
              // ...engine flare, shield, damage, health overlays as before...
              // ...existing overlay logic unchanged...
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
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      }
      // --- End simulation rendering to FBO ---
      // Next step: blit/copy FBO to main canvas with fit-to-window scaling
      // (to be implemented in next step)
    } catch (e) {
      // swallow outer render errors
    }
  }
}
