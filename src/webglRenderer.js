// Minimal WebGL renderer module (clean, single-file baseline).
// Provides a safe minimal implementation so the test/build pipeline can run.

import { supportsUint32Indices, splitVertexRanges } from './webglUtils.js';

function createShader(gl, type, source) {
  const s = gl.createShader(type);
  gl.shaderSource(s, source);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const err = gl.getShaderInfoLog(s);
    gl.deleteShader(s);
    throw new Error('Shader compile error: ' + err);
  }
  return s;
}

function createProgram(gl, vsSrc, fsSrc) {
  const vs = createShader(gl, gl.VERTEX_SHADER, vsSrc);
  const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSrc);
  const p = gl.createProgram();
  gl.attachShader(p, vs);
  gl.attachShader(p, fs);
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    const err = gl.getProgramInfoLog(p);
    gl.deleteProgram(p);
    throw new Error('Program link error: ' + err);
  }
  return p;
}

export function createWebGLRenderer(canvas, opts = {}) {
  const { webgl2 = false } = opts;
  // Allow caller to cap devicePixelRatio to avoid huge drawing buffers that
  // cause long GPU presentation delays on high-DPI displays. Default to 1.5
  // which balances sharpness and performance.
  const maxDevicePixelRatio = (typeof opts.maxDevicePixelRatio === 'number') ? opts.maxDevicePixelRatio : 1.5;
  const atlasAccessor = opts.atlasAccessor || null;
  const atlasLODs = opts.atlasLODs || [1];
  const maxUploadsPerFrame = typeof opts.maxUploadsPerFrame === 'number' ? opts.maxUploadsPerFrame : 2;
  // Options to reduce GPU upload size and enable mipmaps for atlases
  const atlasUseMipmaps = !!opts.atlasUseMipmaps;
  const atlasMaxSize = (typeof opts.atlasMaxSize === 'number') ? opts.atlasMaxSize : 2048;

  let gl = null;
  let running = false;

  const textureCache = new Map();
  const uploadQueue = [];
  const queuedCanvases = new Set();

  const quadVerts = new Float32Array([ -0.5, -0.5, 0, 1, 0.5, -0.5, 1, 1, 0.5, 0.5, 1, 0, -0.5, 0.5, 0, 0 ]);
  const quadIdx = new Uint16Array([0,1,2,0,2,3]);

  const vsTextured = 'attribute vec2 a_pos; attribute vec2 a_uv; uniform vec2 u_resolution; uniform vec2 u_pos; uniform vec2 u_scale; uniform float u_rotation; varying vec2 v_uv; void main(){ vec2 p = a_pos * u_scale; float c = cos(u_rotation); float s = sin(u_rotation); vec2 rp = vec2(p.x * c - p.y * s, p.x * s + p.y * c); vec2 pixelPos = u_pos + rp; vec2 clip = (pixelPos / u_resolution) * 2.0 - 1.0; clip.y = -clip.y; gl_Position = vec4(clip, 0.0, 1.0); v_uv = a_uv; }';
  const fsTextured = 'precision mediump float; uniform sampler2D u_tex; uniform vec4 u_tint; varying vec2 v_uv; void main(){ vec4 t = texture2D(u_tex, v_uv); gl_FragColor = vec4(t.rgb * u_tint.rgb, t.a * u_tint.a); }';

  // Batched textured shader: accepts pre-transformed pixel-space positions
  const vsTexturedBatched = 'attribute vec2 a_pos; attribute vec2 a_uv; uniform vec2 u_resolution; varying vec2 v_uv; void main(){ vec2 clip = (a_pos / u_resolution) * 2.0 - 1.0; clip.y = -clip.y; gl_Position = vec4(clip, 0.0, 1.0); v_uv = a_uv; }';
  const fsTexturedBatched = fsTextured;
  // Instanced shaders (WebGL2): per-vertex quad + per-instance attributes
  const vsInstanced = `#version 300 es
  in vec2 a_pos;
  in vec2 a_uv;
  in vec2 a_off; in vec2 a_scale; in float a_rot; in vec4 a_tint; in float a_shield;
  uniform vec2 u_resolution;
  out vec2 v_uv; out vec4 v_tint; out float v_shield;
  void main(){ vec2 p = a_pos * a_scale; float c = cos(a_rot); float s = sin(a_rot); vec2 rp = vec2(p.x * c - p.y * s, p.x * s + p.y * c); vec2 pixelPos = a_off + rp; vec2 clip = (pixelPos / u_resolution) * 2.0 - 1.0; clip.y = -clip.y; gl_Position = vec4(clip, 0.0, 1.0); v_uv = a_uv; v_tint = a_tint; v_shield = a_shield; }
  `;
  const fsInstanced = `#version 300 es
  precision mediump float;
  uniform sampler2D u_tex;
  in vec2 v_uv; in vec4 v_tint; in float v_shield;
  out vec4 outColor;
  void main(){ vec4 t = texture(u_tex, v_uv); vec3 col = t.rgb * v_tint.rgb;
    // subtle shield tint boost
    col = mix(col, vec3(0.6,0.8,1.0), clamp(v_shield * 0.25, 0.0, 1.0));
    float a = t.a * v_tint.a; outColor = vec4(col, a);
  }
  `;

  const vsDisc = 'attribute vec2 a_pos; attribute vec2 a_uv; varying vec2 v_uv; uniform vec2 u_resolution; uniform vec2 u_pos; uniform vec2 u_scale; void main(){ v_uv = a_uv; vec2 p = a_pos * u_scale + u_pos; vec2 clip = (p / u_resolution) * 2.0 - 1.0; clip.y = -clip.y; gl_Position = vec4(clip, 0.0, 1.0); }';
  const fsDisc = 'precision mediump float; uniform vec4 u_color; varying vec2 v_uv; void main(){ vec2 uv = v_uv; vec2 d = uv - vec2(0.5,0.5); float dist = length(d) * 2.0; float alpha = 1.0 - smoothstep(0.85, 1.0, dist); float glow = 0.15 * (1.0 - smoothstep(0.6, 1.2, dist)); float outA = clamp(u_color.a * alpha + glow * u_color.a, 0.0, 1.0); gl_FragColor = vec4(u_color.rgb * outA, outA); }';

  let progTextured = null;
  let progTexturedBatched = null;
  let progInstanced = null;
  let progDisc = null;
  let quadVBO = null;
  let quadIBO = null;
  let batchVBO = null;
  let batchIBO = null;
  let instanceVBO = null;

  let texturedLoc = null;
  let batchedLoc = null;
  let instancedLoc = null;
  let discLoc = null;

  function doUploadAtlas(atlas) {
    if (!atlas || !atlas.canvas) return null;
    if (textureCache.has(atlas.canvas)) return textureCache.get(atlas.canvas);
    if (!gl) return null;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    try {
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0);
      // Optionally downscale very large atlas canvases to reduce GPU upload cost
      let src = atlas.canvas;
      try {
        const w = src.width || atlas.size || 0;
        const h = src.height || atlas.size || 0;
        if (atlasMaxSize > 0 && Math.max(w, h) > atlasMaxSize && typeof document !== 'undefined') {
          const out = document.createElement('canvas');
          const scale = atlasMaxSize / Math.max(w, h);
          out.width = Math.max(1, Math.floor(w * scale));
          out.height = Math.max(1, Math.floor(h * scale));
          const ctx = out.getContext('2d');
          if (ctx) ctx.drawImage(src, 0, 0, out.width, out.height);
          src = out;
        }
      } catch (e) { /* ignore scaling errors and upload original */ }
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
      if (atlasUseMipmaps) {
        const tw = src.width || atlas.size || 0;
        const th = src.height || atlas.size || 0;
        const isPOT = (v) => (v & (v - 1)) === 0;
        if (isPOT(tw) && isPOT(th)) {
          gl.generateMipmap(gl.TEXTURE_2D);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        } else {
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        }
      } else {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      }
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    } catch (e) {
      const data = new Uint8Array([255,255,255,255]);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1,1,0, gl.RGBA, gl.UNSIGNED_BYTE, data);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }
    const entry = { tex, size: atlas.size, baseRadius: atlas.baseRadius, canvas: atlas.canvas };
    textureCache.set(atlas.canvas, entry);
    queuedCanvases.delete(atlas.canvas);
    return entry;
  }

  function ensureTextureForAtlas(atlas, immediate = false) {
    if (!atlas || !atlas.canvas) return null;
    if (textureCache.has(atlas.canvas)) return textureCache.get(atlas.canvas);
    if (!gl) return null;
    if (immediate) return doUploadAtlas(atlas);
    if (!queuedCanvases.has(atlas.canvas)) { queuedCanvases.add(atlas.canvas); uploadQueue.push(atlas); }
    return null;
  }

  function initGL() {
    gl = canvas.getContext(webgl2 ? 'webgl2' : 'webgl');
    if (!gl) return false;
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    progTextured = createProgram(gl, vsTextured, fsTextured);
  progTexturedBatched = createProgram(gl, vsTexturedBatched, fsTexturedBatched);
  // create instanced program only when WebGL2 is available
  try { if (typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext) progInstanced = createProgram(gl, vsInstanced, fsInstanced); } catch(e) { progInstanced = null; }
    progDisc = createProgram(gl, vsDisc, fsDisc);

  quadVBO = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quadVBO); gl.bufferData(gl.ARRAY_BUFFER, quadVerts, gl.STATIC_DRAW);
  quadIBO = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, quadIBO); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, quadIdx, gl.STATIC_DRAW);
  // Create streaming buffers for dynamic per-frame data. We'll grow them
  // on demand and use bufferSubData for updates to avoid driver reallocs.
  batchVBO = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, batchVBO); gl.bufferData(gl.ARRAY_BUFFER, 1024, gl.DYNAMIC_DRAW);
  batchIBO = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, batchIBO); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, 1024, gl.DYNAMIC_DRAW);
  instVBO = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, instVBO); gl.bufferData(gl.ARRAY_BUFFER, 1024, gl.DYNAMIC_DRAW);
  renderer._batchVBOCapacity = 1024;
  renderer._batchIBOCapacity = 1024;
  renderer._instanceVBOCapacity = 1024;

    texturedLoc = {
      a_pos: gl.getAttribLocation(progTextured, 'a_pos'),
      a_uv: gl.getAttribLocation(progTextured, 'a_uv'),
      u_resolution: gl.getUniformLocation(progTextured, 'u_resolution'),
      u_pos: gl.getUniformLocation(progTextured, 'u_pos'),
      u_scale: gl.getUniformLocation(progTextured, 'u_scale'),
      u_rotation: gl.getUniformLocation(progTextured, 'u_rotation'),
      u_tint: gl.getUniformLocation(progTextured, 'u_tint'),
      u_tex: gl.getUniformLocation(progTextured, 'u_tex')
    };

    batchedLoc = {
      a_pos: gl.getAttribLocation(progTexturedBatched, 'a_pos'),
      a_uv: gl.getAttribLocation(progTexturedBatched, 'a_uv'),
      u_resolution: gl.getUniformLocation(progTexturedBatched, 'u_resolution'),
      u_tint: gl.getUniformLocation(progTexturedBatched, 'u_tint'),
      u_tex: gl.getUniformLocation(progTexturedBatched, 'u_tex')
    };

    // instanced attribute locations (WebGL2 only)
    if (progInstanced) {
      // Use WebGL2 API (getAttribLocation works for program)
      const gl2 = gl;
      // attribute locations will be queried below in a safe way
      // We'll store them in instLoc when available
    }

    discLoc = {
      a_pos: gl.getAttribLocation(progDisc, 'a_pos'),
      a_uv: gl.getAttribLocation(progDisc, 'a_uv'),
      u_resolution: gl.getUniformLocation(progDisc, 'u_resolution'),
      u_pos: gl.getUniformLocation(progDisc, 'u_pos'),
      u_scale: gl.getUniformLocation(progDisc, 'u_scale'),
      u_color: gl.getUniformLocation(progDisc, 'u_color')
    };

    // Create an instanced program when WebGL2 is available for efficient draws
    try { renderer._isWebGL2 = (typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext); } catch (e) { renderer._isWebGL2 = false; }
    if (renderer._isWebGL2) {
      const vsInstanced = 'attribute vec2 a_pos; attribute vec2 a_uv; attribute vec2 a_offset; attribute vec2 a_scale; attribute float a_rotation; attribute vec4 a_tint; varying vec2 v_uv; varying vec4 v_tint; uniform vec2 u_resolution; void main(){ vec2 p = a_pos * a_scale; float c = cos(a_rotation); float s = sin(a_rotation); vec2 rp = vec2(p.x * c - p.y * s, p.x * s + p.y * c); vec2 pixelPos = a_offset + rp; vec2 clip = (pixelPos / u_resolution) * 2.0 - 1.0; clip.y = -clip.y; gl_Position = vec4(clip, 0.0, 1.0); v_uv = a_uv; v_tint = a_tint; }';
      const fsInstanced = 'precision mediump float; uniform sampler2D u_tex; varying vec2 v_uv; varying vec4 v_tint; void main(){ vec4 t = texture2D(u_tex, v_uv); gl_FragColor = vec4(t.rgb * v_tint.rgb, t.a * v_tint.a); }';
      try {
        progInstanced = createProgram(gl, vsInstanced, fsInstanced);
        instancedLoc = {
          a_pos: gl.getAttribLocation(progInstanced, 'a_pos'),
          a_uv: gl.getAttribLocation(progInstanced, 'a_uv'),
          a_offset: gl.getAttribLocation(progInstanced, 'a_offset'),
          a_scale: gl.getAttribLocation(progInstanced, 'a_scale'),
          a_rotation: gl.getAttribLocation(progInstanced, 'a_rotation'),
          a_tint: gl.getAttribLocation(progInstanced, 'a_tint'),
          u_resolution: gl.getUniformLocation(progInstanced, 'u_resolution'),
          u_tex: gl.getUniformLocation(progInstanced, 'u_tex')
        };
        instanceVBO = gl.createBuffer();
      } catch (e) {
        // Fail gracefully: leave instanced path unavailable
        progInstanced = null; instancedLoc = null; instanceVBO = null; renderer._isWebGL2 = false;
      }
    }

    // detect whether 32-bit element indices are supported
    try { renderer._supportsUint32Indices = supportsUint32Indices(gl); } catch (e) { renderer._supportsUint32Indices = false; }

    // Prepare reusable temporary arrays to minimize per-frame allocations
    renderer._tmp = {
      verts: null,
      indices: null,
      inst: null
    };

    // If we have WebGL2 and an instanced program, query attribute/uniform locations
    if (progInstanced && (typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext)) {
      // attribute locations
      renderer._instLoc = {
        a_pos: gl.getAttribLocation(progInstanced, 'a_pos'),
        a_uv: gl.getAttribLocation(progInstanced, 'a_uv'),
        a_off: gl.getAttribLocation(progInstanced, 'a_off'),
        a_scale: gl.getAttribLocation(progInstanced, 'a_scale'),
        a_rot: gl.getAttribLocation(progInstanced, 'a_rot'),
        a_tint: gl.getAttribLocation(progInstanced, 'a_tint'),
        a_shield: gl.getAttribLocation(progInstanced, 'a_shield'),
        u_resolution: gl.getUniformLocation(progInstanced, 'u_resolution'),
        u_tex: gl.getUniformLocation(progInstanced, 'u_tex')
      };
    }

  // Reusable temporary arrays to reduce per-frame allocations
  renderer._tempVertArr = null; renderer._tempIdxArr = null;
  renderer._tempVertCapacity = 0; renderer._tempIdxCapacity = 0;
  renderer._instFloatArr = null; renderer._instCapacity = 0;
  // Current DPR used for the last render call (clamped)
  renderer._dpr = 1;

    return true;
  }

  function drawTexturedQuad(atlasInfo, x, y, r, rot, tint) {
    if (!atlasInfo) return;
    gl.useProgram(progTextured);
    gl.bindBuffer(gl.ARRAY_BUFFER, quadVBO);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, quadIBO);
    if (texturedLoc.a_pos !== -1) { gl.enableVertexAttribArray(texturedLoc.a_pos); gl.vertexAttribPointer(texturedLoc.a_pos, 2, gl.FLOAT, false, 16, 0); }
    if (texturedLoc.a_uv !== -1) { gl.enableVertexAttribArray(texturedLoc.a_uv); gl.vertexAttribPointer(texturedLoc.a_uv, 2, gl.FLOAT, false, 16, 8); }
  const DPR = renderer._dpr || 1;
  gl.uniform2f(texturedLoc.u_resolution, gl.drawingBufferWidth, gl.drawingBufferHeight);
  gl.uniform2f(texturedLoc.u_pos, x * DPR, y * DPR);
    const scale = (r * 2) / (atlasInfo.baseRadius * 2);
    const width = atlasInfo.size * scale * DPR; const height = atlasInfo.size * scale * DPR;
    gl.uniform2f(texturedLoc.u_scale, width, height);
    gl.uniform1f(texturedLoc.u_rotation, rot || 0);
    gl.uniform4f(texturedLoc.u_tint, tint[0], tint[1], tint[2], tint[3]);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, atlasInfo.tex); gl.uniform1i(texturedLoc.u_tex, 0);
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
  }

  function drawDisc(x, y, radius, color) {
    gl.useProgram(progDisc);
    gl.bindBuffer(gl.ARRAY_BUFFER, quadVBO);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, quadIBO);
    if (discLoc.a_pos !== -1) { gl.enableVertexAttribArray(discLoc.a_pos); gl.vertexAttribPointer(discLoc.a_pos, 2, gl.FLOAT, false, 16, 0); }
    if (discLoc.a_uv !== -1) { gl.enableVertexAttribArray(discLoc.a_uv); gl.vertexAttribPointer(discLoc.a_uv, 2, gl.FLOAT, false, 16, 8); }
  const DPR = renderer._dpr || 1;
  gl.uniform2f(discLoc.u_resolution, gl.drawingBufferWidth, gl.drawingBufferHeight);
  gl.uniform2f(discLoc.u_pos, x * DPR, y * DPR);
  gl.uniform2f(discLoc.u_scale, radius * 2 * DPR, radius * 2 * DPR);
    gl.uniform4f(discLoc.u_color, color[0], color[1], color[2], color[3]);
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
  }

  const renderer = {
    type: 'webgl',
    webgl2,
    _supportsUint32Indices: false,
    init() {
      try {
        if (!initGL()) return false;
        if (atlasAccessor) {
          try {
            const types = ['corvette','frigate','destroyer','carrier','fighter'];
            for (const t of types) for (const lod of atlasLODs) {
              const atlas = atlasAccessor(t, lod);
              if (atlas) ensureTextureForAtlas(atlas);
            }
          } catch (e) { /* ignore */ }
        }
        return true;
      } catch (e) { gl = null; return false; }
    },
    start(cb) { running = true; if (cb) cb(); },
    stop() { running = false; },
    isRunning() { return running; },
    render(state) {
      if (!gl) return;
  // Compute a clamped DPR once per frame and reuse it. Clamping avoids
  // enormous drawing buffers on high-DPI screens which can cause long
  // GPU presentation delays (seen in DevTools as "Presentation delay").
  const rawDPR = (typeof window !== 'undefined') ? (window.devicePixelRatio || 1) : 1;
  const DPR = Math.max(1, Math.min(rawDPR, maxDevicePixelRatio));
  renderer._dpr = DPR;
      const clientW = canvas.clientWidth || canvas.width || 800;
      const clientH = canvas.clientHeight || canvas.height || 600;
      const wantW = Math.max(1, Math.floor(clientW * DPR));
      const wantH = Math.max(1, Math.floor(clientH * DPR));
      if (canvas.width !== wantW || canvas.height !== wantH) { canvas.width = wantW; canvas.height = wantH; }
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.clearColor(0.02, 0.02, 0.03, 1); gl.clear(gl.COLOR_BUFFER_BIT);

      let uploads = 0; while (uploads < maxUploadsPerFrame && uploadQueue.length > 0) { const a = uploadQueue.shift(); try { doUploadAtlas(a); } catch(e){} uploads++; }

      if (state.bullets) for (const b of state.bullets) {
        const col = b.team === 0 ? [1.0, 0.35, 0.35, 0.95] : [0.31, 0.62, 1.0, 0.95];
        drawDisc(b.x, b.y, b.radius || 2.2, col);
      }
      // Batch ships by atlas + team and draw in chunks to respect index limits
      if (state.ships) {
        const groups = new Map();
        for (const s of state.ships) {
          if (!s.alive) continue;
          let atlas = null;
          try { atlas = atlasAccessor ? atlasAccessor(s.type, s.radius) : null; } catch (e) { atlas = null; }
          const tint = s.team === 0 ? [1.0, 0.35, 0.35, 0.96] : [0.31, 0.63, 1.0, 0.96];
          if (!atlas || !atlas.canvas) { drawDisc(s.x, s.y, s.radius || 8, tint); continue; }
          // ensure texture upload queued (may return null if not uploaded yet)
          const atlasInfo = ensureTextureForAtlas(atlas);
          if (!atlasInfo || !atlasInfo.tex) { drawDisc(s.x, s.y, s.radius || 8, tint); continue; }
          const key = (atlas.canvas && typeof atlas.canvas.id !== 'undefined') ? atlas.canvas.id : atlas.canvas;
          let entry = groups.get(key);
          if (!entry) { entry = { atlasInfo, byTeam: new Map() }; groups.set(key, entry); }
          const teamArr = entry.byTeam.get(s.team) || [];
          teamArr.push(s);
          entry.byTeam.set(s.team, teamArr);
        }

        // For each group/team, prefer instanced draws on WebGL2; otherwise build
        // vertex/index chunks as before. Instanced draws reduce CPU work and
        // avoid large index uploads because we reuse a single quad index buffer.
        for (const [canvasKey, entry] of groups.entries()) {
          for (const [team, arr] of entry.byTeam.entries()) {
            const atlasInfo = entry.atlasInfo;
            const totalQuads = arr.length;
            if (totalQuads === 0) continue;
            // If WebGL2 instancing is available and we have an instanced program,
            // upload per-instance attributes and draw with a single drawElementsInstanced.
            if (renderer._isWebGL2 && progInstanced && instanceVBO) {
              const instanceFloatCount = totalQuads * 10; // off.x,off.y, scale.x,scale.y, rot, tint.r,g,b,a, shield
              if (!renderer._instFloatArr || renderer._instCapacity < instanceFloatCount) {
                renderer._instFloatArr = new Float32Array(instanceFloatCount);
                renderer._instCapacity = instanceFloatCount;
              }
              const inst = renderer._instFloatArr.subarray(0, instanceFloatCount);
              let io = 0;
              for (let i = 0; i < totalQuads; i++) {
                const s = arr[i];
                const scaleVal = (s.radius * 2) / (atlasInfo.baseRadius * 2);
                const width = atlasInfo.size * scaleVal * DPR;
                const height = atlasInfo.size * scaleVal * DPR;
                inst[io++] = s.x * DPR; inst[io++] = s.y * DPR; // offset
                inst[io++] = width; inst[io++] = height; // scale
                inst[io++] = s.angle || 0; // rot
                const tint = s.team === 0 ? [1.0, 0.35, 0.35, 0.96] : [0.31, 0.63, 1.0, 0.96];
                inst[io++] = tint[0]; inst[io++] = tint[1]; inst[io++] = tint[2]; inst[io++] = tint[3];
                const shieldFraction = (typeof s.shield === 'number' && typeof s.shieldMax === 'number' && s.shieldMax > 0) ? Math.max(0, Math.min(1, s.shield / s.shieldMax)) : 0.0;
                inst[io++] = shieldFraction;
              }

              // Bind quad VBO (per-vertex) and instance VBO (per-instance)
              gl.useProgram(progInstanced);
              gl.bindBuffer(gl.ARRAY_BUFFER, quadVBO);
              if (instancedLoc && instancedLoc.a_pos !== -1) { gl.enableVertexAttribArray(instancedLoc.a_pos); gl.vertexAttribPointer(instancedLoc.a_pos, 2, gl.FLOAT, false, 16, 0); gl.vertexAttribDivisor(instancedLoc.a_pos, 0); }
              if (instancedLoc && instancedLoc.a_uv !== -1) { gl.enableVertexAttribArray(instancedLoc.a_uv); gl.vertexAttribPointer(instancedLoc.a_uv, 2, gl.FLOAT, false, 16, 8); gl.vertexAttribDivisor(instancedLoc.a_uv, 0); }

              gl.bindBuffer(gl.ARRAY_BUFFER, instanceVBO);
              // stream instance data: use bufferSubData when it fits, otherwise grow
              const instBytes = inst.byteLength;
              if (instBytes <= renderer._instanceVBOCapacity) {
                gl.bufferSubData(gl.ARRAY_BUFFER, 0, inst);
              } else {
                // grow to at least double or the needed size
                let newCap = Math.max(instBytes, renderer._instanceVBOCapacity * 2 || instBytes);
                gl.bufferData(gl.ARRAY_BUFFER, newCap, gl.DYNAMIC_DRAW);
                gl.bufferSubData(gl.ARRAY_BUFFER, 0, inst);
                renderer._instanceVBOCapacity = newCap;
              }
              const stride = 10 * 4;
              // a_offset
              if (instancedLoc && instancedLoc.a_offset !== -1) { gl.enableVertexAttribArray(instancedLoc.a_offset); gl.vertexAttribPointer(instancedLoc.a_offset, 2, gl.FLOAT, false, stride, 0); gl.vertexAttribDivisor(instancedLoc.a_offset, 1); }
              // a_scale
              if (instancedLoc && instancedLoc.a_scale !== -1) { gl.enableVertexAttribArray(instancedLoc.a_scale); gl.vertexAttribPointer(instancedLoc.a_scale, 2, gl.FLOAT, false, stride, 8); gl.vertexAttribDivisor(instancedLoc.a_scale, 1); }
              // a_rotation
              if (instancedLoc && instancedLoc.a_rotation !== -1) { gl.enableVertexAttribArray(instancedLoc.a_rotation); gl.vertexAttribPointer(instancedLoc.a_rotation, 1, gl.FLOAT, false, stride, 16); gl.vertexAttribDivisor(instancedLoc.a_rotation, 1); }
              // a_tint
              if (instancedLoc && instancedLoc.a_tint !== -1) { gl.enableVertexAttribArray(instancedLoc.a_tint); gl.vertexAttribPointer(instancedLoc.a_tint, 4, gl.FLOAT, false, stride, 20); gl.vertexAttribDivisor(instancedLoc.a_tint, 1); }
              // a_shield
              if (instancedLoc && instancedLoc.a_shield !== -1) { gl.enableVertexAttribArray(instancedLoc.a_shield); gl.vertexAttribPointer(instancedLoc.a_shield, 1, gl.FLOAT, false, stride, 36); gl.vertexAttribDivisor(instancedLoc.a_shield, 1); }

              gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, quadIBO);
              gl.uniform2f(instancedLoc.u_resolution, gl.drawingBufferWidth, gl.drawingBufferHeight);
              gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, atlasInfo.tex); gl.uniform1i(instancedLoc.u_tex, 0);
              // draw all instances in one call
              gl.drawElementsInstanced(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0, totalQuads);
              // continue to next team
              continue;
            }

            // Fallback non-instanced path (chunked) - existing behavior
            const maxVerticesPerDraw = renderer._supportsUint32Indices ? Number.MAX_SAFE_INTEGER : 65535;
            const maxQuadsPerDraw = Math.max(1, Math.floor(maxVerticesPerDraw / 4));
            // iterate chunks
            for (let start = 0; start < totalQuads; start += maxQuadsPerDraw) {
              const chunkQuads = Math.min(maxQuadsPerDraw, totalQuads - start);
              const vertCount = chunkQuads * 4;
              const idxCount = chunkQuads * 6;
              // Reuse temporary arrays when possible to avoid churn and GC
              const vertFloatCount = vertCount * 4; // x,y,u,v per vertex
              if (!renderer._tempVertArr || renderer._tempVertCapacity < vertFloatCount) {
                renderer._tempVertArr = new Float32Array(vertFloatCount);
                renderer._tempVertCapacity = vertFloatCount;
              }
              const verts = renderer._tempVertArr.subarray(0, vertFloatCount);
              const IndexArrayCtor = renderer._supportsUint32Indices ? Uint32Array : Uint16Array;
              if (!renderer._tempIdxArr || renderer._tempIdxCapacity < idxCount) {
                renderer._tempIdxArr = new IndexArrayCtor(idxCount);
                renderer._tempIdxCapacity = idxCount;
              } else if (!(renderer._tempIdxArr instanceof IndexArrayCtor)) {
                // If type changed (unlikely), reallocate
                renderer._tempIdxArr = new IndexArrayCtor(idxCount);
                renderer._tempIdxCapacity = idxCount;
              }
              const indices = renderer._tempIdxArr.subarray(0, idxCount);
              // Fill vertices and indices for this chunk
              let vOff = 0; let iOff = 0; let baseVert = 0;
              for (let qi = 0; qi < chunkQuads; qi++) {
                const s = arr[start + qi];
                const scale = (s.radius * 2) / (atlasInfo.baseRadius * 2);
                const width = atlasInfo.size * scale * DPR;
                const height = atlasInfo.size * scale * DPR;
                // local quad corners (centered)
                const hx = width * 0.5; const hy = height * 0.5;
                const rot = s.angle || 0;
                const c = Math.cos(rot); const si = Math.sin(rot);
                const cx = s.x * DPR; const cy = s.y * DPR;
                // corners in order matching quadVerts: (-0.5,-0.5),(0.5,-0.5),(0.5,0.5),(-0.5,0.5)
                const corners = [ [-hx, -hy], [hx, -hy], [hx, hy], [-hx, hy] ];
                const uvs = [ [0,1], [1,1], [1,0], [0,0] ];
                for (let k = 0; k < 4; k++) {
                  const lx = corners[k][0]; const ly = corners[k][1];
                  const rx = lx * c - ly * si; const ry = lx * si + ly * c;
                  const px = cx + rx; const py = cy + ry;
                  verts[vOff++] = px; verts[vOff++] = py; verts[vOff++] = uvs[k][0]; verts[vOff++] = uvs[k][1];
                }
                // indices
                indices[iOff++] = baseVert + 0; indices[iOff++] = baseVert + 1; indices[iOff++] = baseVert + 2;
                indices[iOff++] = baseVert + 0; indices[iOff++] = baseVert + 2; indices[iOff++] = baseVert + 3;
                baseVert += 4;
              }

              // Upload buffers and draw
              gl.useProgram(progTexturedBatched);
              gl.bindBuffer(gl.ARRAY_BUFFER, batchVBO);
              // Upload only the used subarray to the GPU using bufferSubData when possible
              const vertsBytes = verts.byteLength;
              if (vertsBytes <= renderer._batchVBOCapacity) {
                gl.bufferSubData(gl.ARRAY_BUFFER, 0, verts);
              } else {
                let newCap = Math.max(vertsBytes, renderer._batchVBOCapacity * 2 || vertsBytes);
                gl.bufferData(gl.ARRAY_BUFFER, newCap, gl.DYNAMIC_DRAW);
                gl.bufferSubData(gl.ARRAY_BUFFER, 0, verts);
                renderer._batchVBOCapacity = newCap;
              }
              gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, batchIBO);
              const idxBytes = indices.byteLength;
              if (idxBytes <= renderer._batchIBOCapacity) {
                gl.bufferSubData(gl.ELEMENT_ARRAY_BUFFER, 0, indices);
              } else {
                let newIBOCap = Math.max(idxBytes, renderer._batchIBOCapacity * 2 || idxBytes);
                gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, newIBOCap, gl.DYNAMIC_DRAW);
                gl.bufferSubData(gl.ELEMENT_ARRAY_BUFFER, 0, indices);
                renderer._batchIBOCapacity = newIBOCap;
              }
              if (batchedLoc.a_pos !== -1) { gl.enableVertexAttribArray(batchedLoc.a_pos); gl.vertexAttribPointer(batchedLoc.a_pos, 2, gl.FLOAT, false, 16, 0); }
              if (batchedLoc.a_uv !== -1) { gl.enableVertexAttribArray(batchedLoc.a_uv); gl.vertexAttribPointer(batchedLoc.a_uv, 2, gl.FLOAT, false, 16, 8); }
              gl.uniform2f(batchedLoc.u_resolution, gl.drawingBufferWidth, gl.drawingBufferHeight);
              const tint = team === 0 ? [1.0, 0.35, 0.35, 0.96] : [0.31, 0.63, 1.0, 0.96];
              gl.uniform4f(batchedLoc.u_tint, tint[0], tint[1], tint[2], tint[3]);
              gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, atlasInfo.tex); gl.uniform1i(batchedLoc.u_tex, 0);
              const indexType = renderer._supportsUint32Indices ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
              gl.drawElements(gl.TRIANGLES, indices.length, indexType, 0);
            }
          }
        }
      }
    }
  };

  renderer.runDiagnostic = function(frames = 3) { try { renderer._diagCounter = Math.max(0, Number(frames) || 3); } catch(e){} };
  renderer.temporarilyLowerOverlay = function() { return false; };
  renderer.destroy = function() { gl = null; running = false; };

  return renderer;
}

// Helper: compute batching ranges for ships without touching GL. Exported for unit tests.
export function computeShipBatchRanges(ships = [], atlasAccessor = null, DPR = 1, supportsUint32 = false) {
  // Group ships by atlas canvas object and team
  const groups = new Map();
  for (const s of ships) {
    if (!s || !s.alive) continue;
    let atlas = null;
    try { atlas = atlasAccessor ? atlasAccessor(s.type, s.radius) : null; } catch (e) { atlas = null; }
    if (!atlas || !atlas.canvas) continue; // only batch textured ones here
  // Use a stable key when available (atlas.canvas.id) so test helpers that
  // return fresh objects per call still group correctly by atlas identity.
  const key = (atlas.canvas && typeof atlas.canvas.id !== 'undefined') ? atlas.canvas.id : atlas.canvas;
    let entry = groups.get(key);
    if (!entry) { entry = { atlas, byTeam: new Map() }; groups.set(key, entry); }
    const teamArr = entry.byTeam.get(s.team) || [];
    teamArr.push(s);
    entry.byTeam.set(s.team, teamArr);
  }

  const results = [];
  for (const [canvasKey, entry] of groups.entries()) {
    for (const [team, arr] of entry.byTeam.entries()) {
      const totalQuads = arr.length;
      const totalVertices = totalQuads * 4;
      const maxVerticesPerDraw = supportsUint32 ? Number.MAX_SAFE_INTEGER : 65535;
      const ranges = splitVertexRanges(totalVertices, maxVerticesPerDraw);
      results.push({ atlasCanvas: canvasKey, team, totalQuads, totalVertices, ranges });
    }
  }
  return results;
}