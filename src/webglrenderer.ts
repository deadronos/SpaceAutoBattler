// src/webglrenderer.ts - Minimal WebGL renderer stub ported from webglRenderer.js
// Provides a typed, minimal WebGL renderer so the rest of the app can opt-in.

import { AssetsConfig, getShipAsset, getTurretAsset, getVisualConfig } from './config/assets/assetsConfig';
import { TeamsConfig } from './config/teamsConfig';
import { shieldFlashIndex, healthFlashIndex, FLASH_TTL_DEFAULT } from './gamemanager';
import { getDefaultShipType } from './config/entitiesConfig';

export class WebGLRenderer {
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
  }

  init(): boolean {
    try {
      // Prefer WebGL2, fall back to WebGL1
      this.gl = this.canvas.getContext('webgl2') as WebGL2RenderingContext | null;
      if (!this.gl) {
        this.gl = (this.canvas.getContext('webgl') || this.canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
        if (!this.gl) return false;
      }
      const gl = this.gl as WebGLRenderingContext;
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
    } catch (e) { /* ignore */ }
  }

  isRunning(): boolean { return false; }

  renderState(state: any, interpolation = 0): void {
    if (!this.gl) return;
    const gl = this.gl as WebGLRenderingContext;
    try {
  // viewport uses backing-store pixel dimensions (canvas.width/height)
  gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      gl.clear(gl.COLOR_BUFFER_BIT);
      // If we have a simple GL program, draw ships as round points with simple overlays
      if (this.prog && this.vertexBuffer) {
        try {
          // prepare arrays for vertices: for each point we pack x,y (clip space), size, r,g,b,a
          const w = this.canvas.clientWidth || Math.round(this.canvas.width / this.pixelRatio);
          const h = this.canvas.clientHeight || Math.round(this.canvas.height / this.pixelRatio);
          const ships = state.ships || [];
          const verts: number[] = [];
          const now = (state && state.t) || 0;
          for (const s of ships) {
            const x = (s.x || 0);
            const y = (s.y || 0);
            const clipX = (x / Math.max(1, w)) * 2 - 1;
            const clipY = 1 - (y / Math.max(1, h)) * 2;
            const radius = s.radius || 6;
            // map radius in logical pixels to gl_PointSize in pixels (approx)
            const ps = Math.max(2, radius * 2);

            // base color: team or hull
            const teamObj = (s.team === 'blue') ? TeamsConfig.teams.blue : TeamsConfig.teams.red;
            const colorHex = (teamObj && teamObj.color) || AssetsConfig.palette.shipHull || '#888';
            const hexToRgba = (hex: string) => {
              const h = hex.replace('#',''); const bigint = parseInt(h.length===3? h.split('').map(c=>c+c).join(''): h,16);
              const r = ((bigint >> 16) & 255)/255; const g = ((bigint >> 8) & 255)/255; const b = (bigint & 255)/255; return [r,g,b,1];
            };
            const baseColor = hexToRgba(colorHex);

            // push base ship point
            verts.push(clipX, clipY, ps, baseColor[0], baseColor[1], baseColor[2], baseColor[3]);

            // engine flare overlay (a second point offset behind ship) - pulse alpha
            try {
              const fallback = getDefaultShipType();
              const vconf = getVisualConfig(s.type || fallback);
              const engineName = (vconf.visuals && vconf.visuals.engine) || 'engineFlare';
              const engine = vconf.animations && vconf.animations[engineName];
              if (engine && engine.type === 'polygon') {
                const pulse = 0.5 + 0.5 * Math.sin((now || 0) * (engine.pulseRate || 6) * Math.PI * 2);
                const offset = (engine.offset != null ? engine.offset : -0.9) * (s.radius || 6);
                const ang = s.angle || 0;
                const ex = x + Math.cos(ang) * offset;
                const ey = y + Math.sin(ang) * offset;
                const cex = (ex / Math.max(1, w)) * 2 - 1;
                const cey = 1 - (ey / Math.max(1, h)) * 2;
                const accent = (vconf.palette && vconf.palette.shipAccent) || AssetsConfig.palette.shipAccent || '#ffd27f';
                const ac = hexToRgba(accent);
                const engAlpha = (engine.alpha != null ? engine.alpha : 0.4);
                verts.push(cex, cey, Math.max(2, ps * 0.9), ac[0], ac[1], ac[2], engAlpha * pulse);
              }
            } catch (e) {}

            // shield overlay as a semi-transparent larger point
            try {
              const fallback = getDefaultShipType();
              const vconf = getVisualConfig(s.type || fallback);
              const shieldName = (vconf.visuals && vconf.visuals.shield) || 'shieldEffect';
              const sh = vconf.animations && vconf.animations[shieldName];
              const shieldPct = (typeof s.shieldPercent === 'number') ? s.shieldPercent : ((s.maxShield && s.maxShield > 0) ? Math.max(0, Math.min(1, (s.shield || 0) / s.maxShield)) : 0);
              if (sh && shieldPct > 0) {
                const pulse = 0.6 + 0.4 * Math.sin((now || 0) * (sh.pulseRate || 2) * Math.PI * 2);
                const accent = sh.color || '#88ccff';
                const ac = hexToRgba(accent);
                const aBase = (sh.alphaBase != null ? sh.alphaBase : 0.25);
                const aScale = (sh.alphaScale != null ? sh.alphaScale : 0.75);
                // Push central shield point
                verts.push(clipX, clipY, Math.max(4, ps * (sh.r || 1.6)), ac[0], ac[1], ac[2], Math.min(1, aBase + aScale * shieldPct) * pulse);
                // If there's a recent shieldFlash for this ship with a hitAngle, render an arc using multiple small points
                try {
                  // TTL-based lookup: use index for fast per-ship lookup
                  let flash: any = null;
                  try {
                    const nowT = (state && state.t) || 0;
                    const arr = shieldFlashIndex.get(s.id) || [];
                    let bestTs = -Infinity;
                    for (const f of arr) {
                      if (!f) continue;
                      const fTs = (typeof f._ts === 'number') ? f._ts : 0;
                      const fTtl = (typeof f.ttl === 'number') ? f.ttl : ((AssetsConfig && (AssetsConfig as any).shield && (AssetsConfig as any).shield.ttl) || 0.4);
                      if (fTs + fTtl >= nowT - 1e-6 && fTs > bestTs) { bestTs = fTs; flash = f; }
                    }
                  } catch (e) { flash = null; }
                  if (flash && typeof flash.hitAngle === 'number') {
                    const arc = (typeof flash.arcWidth === 'number') ? flash.arcWidth : ((vconf && (vconf as any).arcWidth) || (AssetsConfig && (AssetsConfig as any).shieldArcWidth) || Math.PI / 6);
                    const segs: number = 6; // number of samples along the arc
                    const radiusMul = (sh.r || 1.6) * (s.radius || 6);
                    for (let si = 0; si < segs; si++) {
                      const t = segs === 1 ? 0.5 : si / (segs - 1);
                      const a = flash.hitAngle - arc * 0.5 + t * arc;
                      const px = x + Math.cos(a) * radiusMul;
                      const py = y + Math.sin(a) * radiusMul;
                      const cpx = (px / Math.max(1, w)) * 2 - 1;
                      const cpy = 1 - (py / Math.max(1, h)) * 2;
                      const pointSize = Math.max(2, ps * 0.45);
                      const alpha = Math.min(1, aBase + aScale * shieldPct) * pulse * 0.9;
                      verts.push(cpx, cpy, pointSize, ac[0], ac[1], ac[2], alpha);
                    }
                  }
                } catch (e) {}
              }
            } catch (e) {}

            // damage tint overlay point
            try {
              const fallback = getDefaultShipType();
              const vconf = getVisualConfig(s.type || fallback);
              const hpPct = (typeof s.hpPercent === 'number') ? s.hpPercent : Math.max(0, Math.min(1, (s.hp || 0) / (s.maxHp || 1)));
              const thresholds = (AssetsConfig as any).damageThresholds || { moderate: 0.66, heavy: 0.33 };
              let ds = 'light'; if (hpPct < thresholds.heavy) ds = 'heavy'; else if (hpPct < thresholds.moderate) ds = 'moderate';
              const dcfg = vconf.damageStates && vconf.damageStates[ds] || AssetsConfig.damageStates && AssetsConfig.damageStates[ds];
              if (dcfg) {
                const accent = dcfg.accentColor || '#ff6b6b';
                const alpha = (1 - (hpPct || 0)) * (dcfg.opacity || 0.5);
                const ac = hexToRgba(accent);
                verts.push(clipX, clipY, Math.max(2, ps * 1.0), ac[0], ac[1], ac[2], alpha);
              }
            } catch (e) {}

              // health flash overlay: check index for freshest flash and render a small red point
              try {
                const nowT = (state && state.t) || 0;
                let hflash: any = null;
                const harr = healthFlashIndex.get(s.id) || [];
                let bestTsH = -Infinity;
                for (const hf of harr) {
                  if (!hf) continue;
                  const fTs = (typeof hf._ts === 'number') ? hf._ts : 0;
                  const fTtl = (typeof hf.ttl === 'number') ? hf.ttl : FLASH_TTL_DEFAULT;
                  if (fTs + fTtl >= nowT - 1e-6 && fTs > bestTsH) { bestTsH = fTs; hflash = hf; }
                }
                if (hflash) {
                  const hx = (hflash.x != null ? hflash.x : x);
                  const hy = (hflash.y != null ? hflash.y : y);
                  const cpx = (hx / Math.max(1, w)) * 2 - 1;
                  const cpy = 1 - (hy / Math.max(1, h)) * 2;
                  const pointSize = Math.max(2, ps * 0.6);
                  const col = [1, 0.47, 0.4, 0.95]; // reddish
                  verts.push(cpx, cpy, pointSize, col[0], col[1], col[2], col[3]);
                }
              } catch (e) {}
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

          // draw all points in one draw call
          const count = Math.floor(floatArr.length / 7);
          gl.drawArrays(gl.POINTS, 0, count);
        } catch (e) {
          // swallow GL draw errors
        }
      }
    } catch (e) {
      // swallow GL render errors to avoid crashing the app
    }
  }
}

export default WebGLRenderer;
