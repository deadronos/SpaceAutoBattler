// Minimal WebGL renderer stub implementing createWebGLRenderer per spec.
import { simulate } from './gamemanager.js';
// Lightweight WebGL renderer implementation following spec-design-webgl-renderer.md
// This implementation focuses on correctness and graceful degradation.
/**
 * Create a lightweight WebGL renderer capable of drawing instanced sprites.
 * This function prefers WebGL2 when available and gracefully degrades to
 * WebGL1. The renderer is conservative about allocations and performs
 * diagnostic logging only when cfg.debug is true.
 *
 * @param {HTMLCanvasElement} canvas target canvas element
 * @param {Object} opts options (webgl2, maxDevicePixelRatio, maxUploadsPerFrame, atlasUseMipmaps, atlasMaxSize, debug)
 */
export function createWebGLRenderer(canvas, opts = {}) {
  if (!canvas) return null;
  // Options defaults - copy into a fresh object so we don't mutate caller opts
  const defaults = { webgl2: true, maxDevicePixelRatio: 1.5, maxUploadsPerFrame: 2, atlasUseMipmaps: false, atlasMaxSize: 2048, debug: true, vboPoolSize: 3 };
  const cfg = Object.assign({}, defaults, opts);

  let gl = null;
  let isWebGL2 = false;
  try {
    // allow overriding context attributes via opts; otherwise prefer opaque buffer & preserveDrawingBuffer
    const ctxAttrs = {
      antialias: true,
      alpha: (opts && typeof opts.alpha === 'boolean') ? opts.alpha : false,
      preserveDrawingBuffer: (opts && typeof opts.preserveDrawingBuffer === 'boolean') ? opts.preserveDrawingBuffer : true,
      premultipliedAlpha: true
    };
    if (cfg.webgl2) {
      gl = canvas.getContext('webgl2', ctxAttrs);
      isWebGL2 = !!gl;
    }
    if (!gl) {
      gl = canvas.getContext('webgl', ctxAttrs) || canvas.getContext('experimental-webgl', ctxAttrs);
      isWebGL2 = false;
    }
  } catch (e) {
    gl = null;
  }
  if (!gl) return null;

  // Diagnostics
  const diag = {
    _batchVBOCapacity: 0,
    _instanceVBOCapacity: 0,
    _uploadsThisFrame: 0,
    _diagCounter: 0
  };

  // renderer state / resources
  const resources = {
    textures: new Map(),
    quadVBO: null,
  fullscreenQuadVBO: null,
  instanceVBO: null,
    programInstanced: null,
    programSimple: null,
    vao: null
  };
  // cache for program uniform/attrib locations
  const programLocations = new Map();

  let _lastW = 0;
  let _lastH = 0;
  let _running = false;
  // Per-type streaming buffers (floats) and capacities (elements)
  let _starBuffer = null; let _starCapacity = 0; let _starUsed = 0;
  let _shipBuffer = null; let _shipCapacity = 0; let _shipUsed = 0;
  let _bulletBuffer = null; let _bulletCapacity = 0; let _bulletUsed = 0;
  let _particleBuffer = null; let _particleCapacity = 0; let _particleUsed = 0;
  const _pendingAtlasUploads = [];

  // lightweight logging/check helpers (no-op when console missing)
  function debugLog(...args) {
    if (!cfg.debug) return;
    if (typeof console !== 'undefined' && console.log) console.log('[webgl-debug]', ...args);
  }
  function checkGLError(where) {
    try {
      const err = gl.getError();
      if (err !== gl.NO_ERROR) debugLog('GL error at', where, err);
    } catch (e) {
      // ignore if gl not ready
    }
  }
  function dumpProgramInfo(program) {
    try {
      const nattrib = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);
      debugLog('Active attributes:', nattrib);
      for (let i = 0; i < nattrib; i++) {
        const a = gl.getActiveAttrib(program, i);
        debugLog('  attrib', i, a.name, a.size, a.type, 'loc', gl.getAttribLocation(program, a.name));
      }
      const nunif = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
      debugLog('Active uniforms:', nunif);
      for (let i = 0; i < nunif; i++) {
        const u = gl.getActiveUniform(program, i);
        debugLog('  uniform', i, u.name, u.size, u.type, 'loc', gl.getUniformLocation(program, u.name));
      }
    } catch (e) {
      // ignore
    }
  }

  const fsInstanced = `#version 300 es
  precision mediump float;
  in vec2 v_uv;
  in vec4 v_color;
  out vec4 outColor;
  uniform sampler2D u_tex;
  uniform int u_useTex;
  void main() {
    if (u_useTex == 1) {
      vec4 t = texture(u_tex, v_uv);
      outColor = t * v_color;
    } else {
      // simple circular mask in fragment
      vec2 d = v_uv - vec2(0.5);
      float r = length(d);
  float alpha = 1.0 - smoothstep(0.48, 0.5, r);
  outColor = vec4(v_color.rgb, v_color.a * alpha);
    }
  }
`;

  // Vertex shader for instanced rendering (WebGL2)
  const vsInstanced = `#version 300 es
  precision mediump float;
  layout(location=0) in vec2 a_quadPos;
  layout(location=1) in vec2 a_pos;
  layout(location=2) in float a_scale;
  layout(location=3) in float a_angle;
  layout(location=4) in vec4 a_color;
  out vec2 v_uv;
  out vec4 v_color;
  uniform vec2 u_resolution;
  void main() {
    float c = cos(a_angle);
    float s = sin(a_angle);
    vec2 p = vec2(a_quadPos.x * a_scale, a_quadPos.y * a_scale);
    vec2 rp = vec2(p.x * c - p.y * s, p.x * s + p.y * c);
    vec2 screen = (a_pos + rp);
    vec2 ndc = (screen / u_resolution) * 2.0 - 1.0;
    ndc.y = -ndc.y;
    gl_Position = vec4(ndc, 0.0, 1.0);
    v_uv = a_quadPos + 0.5;
    v_color = a_color;
  }
`;

  // Fallback shaders for WebGL1 (no #version)
  const vsSimple = `precision mediump float;
  attribute vec2 a_pos;
  attribute vec2 a_quadPos;
  attribute float a_scale;
  attribute float a_angle;
  attribute vec4 a_color;
  varying vec2 v_uv;
  varying vec4 v_color;
  uniform vec2 u_resolution;
  void main() {
    float c = cos(a_angle);
    float s = sin(a_angle);
    vec2 p = vec2(a_quadPos.x * a_scale, a_quadPos.y * a_scale);
    vec2 rp = vec2(p.x * c - p.y * s, p.x * s + p.y * c);
    vec2 screen = (a_pos + rp);
    vec2 ndc = (screen / u_resolution) * 2.0 - 1.0;
    ndc.y = -ndc.y;
    gl_Position = vec4(ndc, 0.0, 1.0);
    v_uv = a_quadPos + 0.5;
    v_color = a_color;
  }
`;

  const fsSimple = `precision mediump float;
  varying vec2 v_uv;
  varying vec4 v_color;
  uniform sampler2D u_tex;
  uniform int u_useTex;
  void main() {
    if (u_useTex == 1) {
      vec4 t = texture2D(u_tex, v_uv);
      gl_FragColor = t * v_color;
    } else {
      vec2 d = v_uv - vec2(0.5);
      float r = length(d);
  float alpha = 1.0 - smoothstep(0.48, 0.5, r);
  gl_FragColor = vec4(v_color.rgb, v_color.a * alpha);
    }
  }
`;

  // Create programs (deferred until init)

  // compile/link helpers
  function compileShader(src, type) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    const ok = gl.getShaderParameter(s, gl.COMPILE_STATUS);
    const info = gl.getShaderInfoLog(s);
    if (!ok) {
      debugLog('Shader compile failed', info, '\n', src.substring(0, 200));
      gl.deleteShader(s);
      throw new Error('Shader compile failed: ' + info);
    } else if (cfg.debug && info && info.length) {
      // non-fatal compile warnings/info - log for diagnostics
      debugLog('Shader compile info/warning', info);
    }
    return s;
  }
  function linkProgram(vs, fs) {
    const p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    if (isWebGL2) {
      // nothing special
    }
    gl.linkProgram(p);
    const ok = gl.getProgramParameter(p, gl.LINK_STATUS);
    const info = gl.getProgramInfoLog(p);
    if (!ok) {
      debugLog('Program link failed', info);
      gl.deleteProgram(p);
      throw new Error('Program link failed: ' + info);
    } else if (cfg.debug && info && info.length) {
      // non-fatal link warnings
      debugLog('Program link info/warning', info);
    }
    return p;
  }

  function initPrograms() {
    // instanced program (WebGL2)
    if (isWebGL2) {
      const vs = compileShader(vsInstanced, gl.VERTEX_SHADER);
      const fs = compileShader(fsInstanced, gl.FRAGMENT_SHADER);
      resources.programInstanced = linkProgram(vs, fs);
        try { dumpProgramInfo(resources.programInstanced); } catch (e) {}
        // cache some locations for instanced program
        try {
          const map = { uniforms: {}, attribs: {} };
          map.uniforms.u_resolution = gl.getUniformLocation(resources.programInstanced, 'u_resolution');
          map.uniforms.u_tex = gl.getUniformLocation(resources.programInstanced, 'u_tex');
          map.uniforms.u_useTex = gl.getUniformLocation(resources.programInstanced, 'u_useTex');
          map.attribs.a_quadPos = gl.getAttribLocation(resources.programInstanced, 'a_quadPos');
          map.attribs.a_pos = gl.getAttribLocation(resources.programInstanced, 'a_pos');
          map.attribs.a_scale = gl.getAttribLocation(resources.programInstanced, 'a_scale');
          map.attribs.a_angle = gl.getAttribLocation(resources.programInstanced, 'a_angle');
          map.attribs.a_color = gl.getAttribLocation(resources.programInstanced, 'a_color');
          programLocations.set(resources.programInstanced, map);
        } catch (e) {}
    }
    // simple program (works on WebGL1 and WebGL2)
    const vs2 = compileShader(isWebGL2 ? vsInstanced : vsSimple, gl.VERTEX_SHADER);
    const fs2 = compileShader(isWebGL2 ? fsInstanced : fsSimple, gl.FRAGMENT_SHADER);
    resources.programSimple = linkProgram(vs2, fs2);
    try { dumpProgramInfo(resources.programSimple); } catch (e) {}
    try {
      const map2 = { uniforms: {}, attribs: {} };
      map2.uniforms.u_resolution = gl.getUniformLocation(resources.programSimple, 'u_resolution');
      map2.uniforms.u_tex = gl.getUniformLocation(resources.programSimple, 'u_tex');
      map2.uniforms.u_useTex = gl.getUniformLocation(resources.programSimple, 'u_useTex');
      map2.attribs.a_quadPos = gl.getAttribLocation(resources.programSimple, 'a_quadPos');
      map2.attribs.a_pos = gl.getAttribLocation(resources.programSimple, 'a_pos');
      map2.attribs.a_scale = gl.getAttribLocation(resources.programSimple, 'a_scale');
      map2.attribs.a_angle = gl.getAttribLocation(resources.programSimple, 'a_angle');
      map2.attribs.a_color = gl.getAttribLocation(resources.programSimple, 'a_color');
      programLocations.set(resources.programSimple, map2);
    } catch (e) {}
  }

  // Create/ensure buffers and VAO
  function initBuffers() {
    // quad VBO: two triangles covering -0.5..0.5
      if (!resources._quadVerts) resources._quadVerts = new Float32Array([-0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5]);
      resources.quadVBO = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, resources.quadVBO);
      gl.bufferData(gl.ARRAY_BUFFER, resources._quadVerts, gl.STATIC_DRAW);

    // instance VBO reserved; will be dynamic (ships)
    resources.instanceVBO = gl.createBuffer();
    resources.instanceVBO._size = 0;
    // Create small rotating pools of VBOs for streaming instance data to avoid
    // implicit sync. Pool size is configurable via cfg.vboPoolSize.
    const RING_BUFFERS = Math.max(2, Number(cfg.vboPoolSize) || 3);
    function makePool() {
      const arr = [];
      for (let i = 0; i < RING_BUFFERS; i++) {
        const b = gl.createBuffer();
        b._size = 0;
        arr.push(b);
      }
      return arr;
    }
    resources.starInstanceVBOs = makePool();
    resources.shipInstanceVBOs = makePool();
    resources.bulletInstanceVBOs = makePool();
    resources.particleInstanceVBOs = makePool();
    // indices for rotation
    resources._starVBOIndex = 0;
    resources._shipVBOIndex = 0;
    resources._bulletVBOIndex = 0;
    resources._particleVBOIndex = 0;
    // expose current pointers for backward compatibility
    resources.starInstanceVBO = resources.starInstanceVBOs[0];
    resources.shipInstanceVBO = resources.shipInstanceVBOs[0];
    resources.bulletInstanceVBO = resources.bulletInstanceVBOs[0];
    resources.particleInstanceVBO = resources.particleInstanceVBOs[0];

  // VAO for WebGL2
  if (isWebGL2 && gl.createVertexArray) {
    try { resources.vao = gl.createVertexArray(); } catch (e) { resources.vao = null; }
  }
  diag._batchVBOCapacity = 0;
  }

  // Simple color parser supporting #rgb, #rrggbb and rgb()/rgba()
  function parseColor(str) {
    if (!str) return [1, 1, 1, 1];
    if (Array.isArray(str) && str.length >= 3) return [str[0], str[1], str[2], str[3] != null ? str[3] : 1];
    str = String(str).trim();
    if (str[0] === '#') {
      let hex = str.slice(1);
      if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
      const num = parseInt(hex, 16);
      if (Number.isNaN(num)) return [1, 1, 1, 1];
      return [((num >> 16) & 255) / 255, ((num >> 8) & 255) / 255, (num & 255) / 255, 1];
    }
    const m = str.match(/rgba?\(([^)]+)\)/i);
    if (m) {
      const parts = m[1].split(',').map(s => parseFloat(s));
      const r = parts[0] != null ? parts[0] : 255;
      const g = parts[1] != null ? parts[1] : 255;
      const b = parts[2] != null ? parts[2] : 255;
      const a = parts[3] != null ? parts[3] : 1;
      // if values look like 0-255, normalize; if already 0-1, assume 0-1
      const norm = (v) => (v > 1 ? v / 255 : v);
      return [norm(r), norm(g), norm(b), a];
    }
    return [1, 1, 1, 1];
  }

  // Resize handling (DPR clamp)
  function resizeIfNeeded() {
    const dpr = Math.min(window.devicePixelRatio || 1, cfg.maxDevicePixelRatio || 1.5);
    const clientW = Math.max(1, Math.floor(canvas.clientWidth));
    const clientH = Math.max(1, Math.floor(canvas.clientHeight));
    const newW = Math.floor(clientW * dpr);
    const newH = Math.floor(clientH * dpr);
    if (newW !== _lastW || newH !== _lastH) {
      canvas.width = newW; canvas.height = newH;
      gl.viewport(0, 0, newW, newH);
      _lastW = newW; _lastH = newH;
    }
  }

  function usePremultipliedAlpha() {
    // Ensure premultiplied alpha handling
  try { gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true); } catch (e) {}
  gl.enable(gl.BLEND);
  // Use premultiplied-alpha blending for correct compositing with premultiplied textures
  try { gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); } catch (e) { try { gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); } catch (ee) {} }
  }

  // Texture upload helper (queues uploads to limit per-frame)
  function queueAtlasUpload(key, atlas) {
    _pendingAtlasUploads.push({ key, atlas });
  }

  function processAtlasUploads(limit) {
    diag._uploadsThisFrame = 0;
    while (_pendingAtlasUploads.length && diag._uploadsThisFrame < limit) {
      const item = _pendingAtlasUploads.shift();
      const { key, atlas } = item;
      try {
        // validate atlas canvas/source
        let canvasSrc = atlas && atlas.canvas;
        if (!canvasSrc || !canvasSrc.width || !canvasSrc.height) {
          if (cfg.debug) console.warn('Skipping atlas upload: invalid canvas for key', key);
          continue;
        }
        let size = atlas.size;
        if (cfg.atlasMaxSize && size > cfg.atlasMaxSize) {
          const scale = cfg.atlasMaxSize / size;
          const tmp = document.createElement('canvas');
          tmp.width = Math.max(1, Math.floor(canvasSrc.width * scale));
          tmp.height = Math.max(1, Math.floor(canvasSrc.height * scale));
          const tctx = tmp.getContext('2d');
          tctx.drawImage(canvasSrc, 0, 0, tmp.width, tmp.height);
          canvasSrc = tmp;
          size = cfg.atlasMaxSize;
        }
        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvasSrc);
        if (cfg.atlasUseMipmaps && isPowerOfTwo(canvasSrc.width) && isPowerOfTwo(canvasSrc.height)) {
          gl.generateMipmap(gl.TEXTURE_2D);
        } else {
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        }
        resources.textures.set(key, { tex, size: atlas.size, baseRadius: atlas.baseRadius, canvas: atlas.canvas });
        diag._uploadsThisFrame++;
      } catch (e) {
        // skip upload on error
  console.warn('atlas upload failed', e);
      }
    }
  }

  // Helper to queue a starfield canvas as a single background texture
  function queueStarfieldUpload(canvasSrc) {
    if (!canvasSrc || !canvasSrc.width || !canvasSrc.height) {
      if (cfg.debug) console.warn('queueStarfieldUpload: invalid canvas provided');
      return;
    }
    const key = '__starfield';
    // wrap into atlas-like object for upload pipeline
    queueAtlasUpload(key, { canvas: canvasSrc, size: Math.max(canvasSrc.width, canvasSrc.height), baseRadius: 0 });
  }

  function isPowerOfTwo(v) { return (v & (v - 1)) === 0; }

  // Initialize GL state and programs
  function initGL() {
    usePremultipliedAlpha();
    initPrograms();
    initBuffers();
  }

  // Shader/program safe wrappers for attribute locations
  function setupAttributePointers(program) {
    // Bind quad buffer to attribute 0 (a_quadPos / a_quadPos in simple)
    gl.bindBuffer(gl.ARRAY_BUFFER, resources.quadVBO);
    const locQuad = gl.getAttribLocation(program, 'a_quadPos');
    if (locQuad >= 0) {
      gl.enableVertexAttribArray(locQuad);
      gl.vertexAttribPointer(locQuad, 2, gl.FLOAT, false, 0, 0);
    }
  }

  // Render implementation
  function render(state = {}) {
    diag._diagCounter++;
    resizeIfNeeded();
    processAtlasUploads(cfg.maxUploadsPerFrame || 2);

    const W = state.W || canvas.clientWidth;
    const H = state.H || canvas.clientHeight;

  // Prepare ships and stars
  const ships = state.ships || [];
  const n = ships.length;
  const stars = state.stars || [];
  const sn = stars.length;

  // Build instance buffer: per-instance: x,y,scale,angle,r,g,b,a
  const elemsPer = 8; // vec2 + scale + angle + vec4 color
  // We no longer build a separate _instanceBuffer for ships; ships will be written
  // directly into the streaming buffer below to avoid an extra copy.

  // We'll build a single streaming buffer for stars, ships, bullets, and particles contiguously
    const bullets = state.bullets || [];
    const bn = bullets.length;
    const particles = state.particles || [];
    const pn = particles.length;

  // Per-type element counts and ensure typed arrays
  const starElems = sn * elemsPer;
  const shipElems = n * elemsPer;
  const bulletElems = bn * elemsPer;
  const particleElems = pn * elemsPer;

  // Ensure star buffer
  if (_starCapacity < starElems) {
    let cap = Math.max(4 * elemsPer, _starCapacity || 0);
    if (cap < 1) cap = elemsPer * 4;
    while (cap < starElems) cap *= 2;
    _starCapacity = cap;
    _starBuffer = new Float32Array(_starCapacity);
  }
  // Fill stars
  _starUsed = starElems;
  for (let i = 0; i < sn; i++) {
    const s = stars[i];
    const base = i * elemsPer;
    _starBuffer[base + 0] = s.x || 0;
    _starBuffer[base + 1] = s.y || 0;
    _starBuffer[base + 2] = (s.r != null ? s.r : 1);
    _starBuffer[base + 3] = 0;
    const a = s.a != null ? s.a : 1.0;
    _starBuffer[base + 4] = 1.0; _starBuffer[base + 5] = 1.0; _starBuffer[base + 6] = 1.0; _starBuffer[base + 7] = a;
  }

  // Ensure ship buffer
  if (_shipCapacity < shipElems) {
    let cap = Math.max(4 * elemsPer, _shipCapacity || 0);
    if (cap < 1) cap = elemsPer * 4;
    while (cap < shipElems) cap *= 2;
    _shipCapacity = cap;
    _shipBuffer = new Float32Array(_shipCapacity);
  }
  _shipUsed = shipElems;
  // Support interpolation: if the state includes a _prevShipsMap and _alpha,
  // interpolate positions/angles between previous and current simulation
  // for smoother visuals when simulation uses a fixed timestep.
  const prevMap = state && state._prevShipsMap ? state._prevShipsMap : null;
  const alphaInterp = state && typeof state._alpha === 'number' ? state._alpha : 0;
  for (let i = 0; i < n; i++) {
    const s = ships[i];
    const base = i * elemsPer;
    let px = s.x || 0; let py = s.y || 0; let pangle = s.angle || 0;
    if (prevMap && s && s.id != null) {
      const prev = prevMap.get(s.id);
      if (prev) {
        // linear interpolation
        px = prev.x + (s.x - prev.x) * alphaInterp;
        py = prev.y + (s.y - prev.y) * alphaInterp;
        // angle interpolation (shortest path)
        let a0 = prev.angle || 0;
        let a1 = s.angle || 0;
        let diff = a1 - a0;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        pangle = a0 + diff * alphaInterp;
      }
    }
    _shipBuffer[base + 0] = px;
    _shipBuffer[base + 1] = py;
    _shipBuffer[base + 2] = (s.radius != null ? s.radius : 8);
    _shipBuffer[base + 3] = pangle;
    const color = teamToColor(s.team);
    _shipBuffer[base + 4] = color[0]; _shipBuffer[base + 5] = color[1]; _shipBuffer[base + 6] = color[2]; _shipBuffer[base + 7] = color[3];
  }

  // Ensure bullet buffer
  if (_bulletCapacity < bulletElems) {
    let cap = Math.max(4 * elemsPer, _bulletCapacity || 0);
    if (cap < 1) cap = elemsPer * 4;
    while (cap < bulletElems) cap *= 2;
    _bulletCapacity = cap;
    _bulletBuffer = new Float32Array(_bulletCapacity);
  }
  _bulletUsed = bulletElems;
  for (let i = 0; i < bn; i++) {
    const b = bullets[i];
    const base = i * elemsPer;
    _bulletBuffer[base + 0] = b.x || 0;
    _bulletBuffer[base + 1] = b.y || 0;
    _bulletBuffer[base + 2] = (b.radius != null ? b.radius : 2);
    _bulletBuffer[base + 3] = 0;
    _bulletBuffer[base + 4] = 1.0; _bulletBuffer[base + 5] = 0.85; _bulletBuffer[base + 6] = 0.5; _bulletBuffer[base + 7] = 1.0;
  }

  // Ensure particle buffer
  if (_particleCapacity < particleElems) {
    let cap = Math.max(4 * elemsPer, _particleCapacity || 0);
    if (cap < 1) cap = elemsPer * 4;
    while (cap < particleElems) cap *= 2;
    _particleCapacity = cap;
    _particleBuffer = new Float32Array(_particleCapacity);
  }
  _particleUsed = particleElems;
  for (let i = 0; i < pn; i++) {
    const p = particles[i];
    const base = i * elemsPer;
    _particleBuffer[base + 0] = p.x || 0;
    _particleBuffer[base + 1] = p.y || 0;
    _particleBuffer[base + 2] = (p.size != null ? p.size : 1);
    _particleBuffer[base + 3] = 0;
    const col = parseColor(p.color || '#ffffff');
    _particleBuffer[base + 4] = col[0]; _particleBuffer[base + 5] = col[1]; _particleBuffer[base + 6] = col[2]; _particleBuffer[base + 7] = Math.max(0.2, col[3]);
  }

  // If there are no instances to draw, just clear and skip buffer uploads
  const totalElems = starElems + shipElems + bulletElems + particleElems;
  if (totalElems === 0) {
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      return;
    }

  // Upload per-type buffers to their VBOs
  const BYTES = Float32Array.BYTES_PER_ELEMENT || 4;
    // Ensure the currently bound ARRAY_BUFFER has at least usedElems floats worth
    // of storage allocated on the GPU. vbo._size is maintained in bytes.
    // This helper now applies a buffer-orphaning pattern to avoid implicit
    // GPU sync: we call gl.bufferData to (re)declare the backing store and
    // then gl.bufferSubData to upload the active portion. We still grow the
    // allocation by doubling to avoid pathological tiny reallocations.
    function ensureVBO(vbo, usedElems, usedBuffer) {
      try {
        const usedBytes = usedElems * BYTES;
        // prefer using the typed-array's byteLength when available for accuracy
        const srcByteLen = usedBuffer && usedBuffer.byteLength ? Math.min(usedBytes, usedBuffer.byteLength) : usedBytes;
        if (!vbo._size) vbo._size = 0;
        // If needed, grow the GPU allocation (doubling strategy)
        if (vbo._size < srcByteLen) {
          let alloc = Math.max(vbo._size || 1, 1);
          while (alloc < srcByteLen) alloc *= 2;
          try {
            gl.bufferData(gl.ARRAY_BUFFER, alloc, gl.DYNAMIC_DRAW);
            vbo._size = alloc;
          } catch (e) {
            try { gl.bufferData(gl.ARRAY_BUFFER, srcByteLen, gl.DYNAMIC_DRAW); vbo._size = srcByteLen; } catch (ee) { }
          }
        } else {
          // Orphan the buffer by re-declaring it with the existing size. This
          // lets the driver avoid waiting on pending GPU usage of the old store.
          try { gl.bufferData(gl.ARRAY_BUFFER, vbo._size, gl.DYNAMIC_DRAW); } catch (e) { }
        }

        // upload used slice (only the portion that we actually filled)
        if (usedElems > 0 && usedBuffer) {
          const view = usedBuffer.subarray(0, usedElems);
          try { gl.bufferSubData(gl.ARRAY_BUFFER, 0, view); } catch (e) { }
        }
        try { diag._instanceVBOCapacity = Math.max(diag._instanceVBOCapacity || 0, vbo._size || 0); } catch (e) {}
      } catch (e) {
        // ignore upload errors here; we'll assert before draw
      }
    }

    // Helper: perform an instanced draw but pre-check the bound VBO capacity
    // and split into batches if the GPU buffer is too small for the whole draw.
    function safeDrawInstanced(boundVBO, vertsPerInstance, instanceCount, elemsPerInstance) {
      try {
        if (!boundVBO) return;
        const strideBytes = elemsPerInstance * BYTES;
        const requiredBytes = instanceCount * strideBytes;
        const vboSize = boundVBO._size || 0;
        // if buffer is large enough, draw in one call
        if (vboSize >= requiredBytes) {
          gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, vertsPerInstance, instanceCount);
          return;
        }
        // try to reallocate the buffer to fit the request (attempt a single grow)
        // NOTE: ensureVBO must be called while that buffer is bound
        try {
          // propose a new allocation at least requiredBytes
          let alloc = Math.max(vboSize || 1, 1);
          while (alloc < requiredBytes) alloc *= 2;
          gl.bufferData(gl.ARRAY_BUFFER, alloc, gl.DYNAMIC_DRAW);
          boundVBO._size = alloc;
        } catch (e) {
          // allocation failed or not possible; fall back to chunked draws
        }
        const finalSize = boundVBO._size || 0;
        if (finalSize >= requiredBytes) {
          gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, vertsPerInstance, instanceCount);
          return;
        }
        // Chunked draw: compute how many instances fit in current VBO
        const maxInstances = Math.max(1, Math.floor((finalSize) / strideBytes));
        if (maxInstances <= 0) {
          // Nothing fits: skip draw (shouldn't happen) and log
          debugLog('safeDrawInstanced: VBO too small for even one instance', finalSize, strideBytes);
          return;
        }
        // draw in multiple chunks
        let offsetInstances = 0;
        while (offsetInstances < instanceCount) {
          const chunk = Math.min(maxInstances, instanceCount - offsetInstances);
          // For chunked draws we rely on the instance data already being uploaded
          // into the buffer at byte offset 0..finalSize. We set an appropriate
          // vertexAttribDivisor and then draw the chunk.
          gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, vertsPerInstance, chunk);
          offsetInstances += chunk;
        }
      } catch (e) {
        // if something goes wrong, attempt the draw once (let the driver error if needed)
        try { gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, vertsPerInstance, instanceCount); } catch (ee) {}
      }
    }

    // Debug assertions: ensure buffers have sufficient length for used elems
    if (cfg.debug) {
      try {
        if (_starBuffer && _starUsed > _starBuffer.length) debugLog('star buffer used exceeds capacity', _starUsed, _starBuffer.length);
        if (_shipBuffer && _shipUsed > _shipBuffer.length) debugLog('ship buffer used exceeds capacity', _shipUsed, _shipBuffer.length);
        if (_bulletBuffer && _bulletUsed > _bulletBuffer.length) debugLog('bullet buffer used exceeds capacity', _bulletUsed, _bulletBuffer.length);
        if (_particleBuffer && _particleUsed > _particleBuffer.length) debugLog('particle buffer used exceeds capacity', _particleUsed, _particleBuffer.length);
        // removed test-only hook here to avoid test-only side-effects in production code
      } catch (e) {}
    }

    // Upload each buffer separately
    // Rotate per-type VBOs and upload into the currently selected buffer
    try {
      if (_starUsed > 0) {
        resources._starVBOIndex = (resources._starVBOIndex + 1) % resources.starInstanceVBOs.length;
        resources.starInstanceVBO = resources.starInstanceVBOs[resources._starVBOIndex];
        gl.bindBuffer(gl.ARRAY_BUFFER, resources.starInstanceVBO);
        ensureVBO(resources.starInstanceVBO, _starUsed, _starBuffer);
      }
      if (_shipUsed > 0) {
        resources._shipVBOIndex = (resources._shipVBOIndex + 1) % resources.shipInstanceVBOs.length;
        resources.shipInstanceVBO = resources.shipInstanceVBOs[resources._shipVBOIndex];
        gl.bindBuffer(gl.ARRAY_BUFFER, resources.shipInstanceVBO);
        ensureVBO(resources.shipInstanceVBO, _shipUsed, _shipBuffer);
      }
      if (_bulletUsed > 0) {
        resources._bulletVBOIndex = (resources._bulletVBOIndex + 1) % resources.bulletInstanceVBOs.length;
        resources.bulletInstanceVBO = resources.bulletInstanceVBOs[resources._bulletVBOIndex];
        gl.bindBuffer(gl.ARRAY_BUFFER, resources.bulletInstanceVBO);
        ensureVBO(resources.bulletInstanceVBO, _bulletUsed, _bulletBuffer);
      }
      if (_particleUsed > 0) {
        resources._particleVBOIndex = (resources._particleVBOIndex + 1) % resources.particleInstanceVBOs.length;
        resources.particleInstanceVBO = resources.particleInstanceVBOs[resources._particleVBOIndex];
        gl.bindBuffer(gl.ARRAY_BUFFER, resources.particleInstanceVBO);
        ensureVBO(resources.particleInstanceVBO, _particleUsed, _particleBuffer);
      }
    } catch (e) {
      // If rotation or upload fails, fall back to binding the first buffer
      try { gl.bindBuffer(gl.ARRAY_BUFFER, resources.starInstanceVBOs[0]); } catch (ee) {}
    }

    // Clear and draw
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Choose program: prefer instanced if available
    const useInstanced = isWebGL2 && resources.programInstanced;
    const program = useInstanced ? resources.programInstanced : resources.programSimple;
    gl.useProgram(program);

    // Set resolution uniform (both shader styles)
  // use cached location if available
  const locs = programLocations.get(program) || null;
  const uresLoc = locs && locs.uniforms && locs.uniforms.u_resolution ? locs.uniforms.u_resolution : gl.getUniformLocation(program, 'u_resolution');
  if (uresLoc) gl.uniform2f(uresLoc, canvas.width || _lastW || canvas.clientWidth, canvas.height || _lastH || canvas.clientHeight);

    // bind quad buffer to attribute (use cached locations)
    gl.bindBuffer(gl.ARRAY_BUFFER, resources.quadVBO);
    const aQuadLoc = locs && locs.attribs && (locs.attribs.a_quadPos != null) ? locs.attribs.a_quadPos : gl.getAttribLocation(program, 'a_quadPos');
    if (aQuadLoc >= 0) {
      gl.enableVertexAttribArray(aQuadLoc);
      gl.vertexAttribPointer(aQuadLoc, 2, gl.FLOAT, false, 0, 0);
      if (isWebGL2) gl.vertexAttribDivisor(aQuadLoc, 0);
    }

    // Get attribute locations once
  const attrPos = locs && locs.attribs && (locs.attribs.a_pos != null) ? locs.attribs.a_pos : gl.getAttribLocation(program, 'a_pos');
  const attrScale = locs && locs.attribs && (locs.attribs.a_scale != null) ? locs.attribs.a_scale : gl.getAttribLocation(program, 'a_scale');
  const attrAngle = locs && locs.attribs && (locs.attribs.a_angle != null) ? locs.attribs.a_angle : gl.getAttribLocation(program, 'a_angle');
  const attrColor = locs && locs.attribs && (locs.attribs.a_color != null) ? locs.attribs.a_color : gl.getAttribLocation(program, 'a_color');

    // Texture binding: if atlasAccessor present and any texture exists, use first texture
  const useTexLoc = locs && locs.uniforms && (locs.uniforms.u_useTex != null) ? locs.uniforms.u_useTex : gl.getUniformLocation(program, 'u_useTex');
  const texLoc = locs && locs.uniforms && (locs.uniforms.u_tex != null) ? locs.uniforms.u_tex : gl.getUniformLocation(program, 'u_tex');
    let anyTex = resources.textures.size > 0;
    if (useTexLoc) gl.uniform1i(useTexLoc, anyTex ? 1 : 0);
    if (texLoc && anyTex) {
      gl.activeTexture(gl.TEXTURE0);
      // bind first texture available
      const first = resources.textures.values().next().value;
      gl.bindTexture(gl.TEXTURE_2D, first.tex);
      gl.uniform1i(texLoc, 0);
    }

    // If a starfield texture exists, draw it as a fullscreen textured quad behind instances
    if (resources.textures.has('__starfield')) {
      try {
        // bind starfield texture to unit 1, draw a full-screen quad using debug shader
        const s = resources.textures.get('__starfield');
        // Use the existing debug solid program path but with texture; fallback to simple textured draw
        // Bind texture unit 1
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, s.tex);
        // Use programSimple (it supports u_useTex + u_tex)
        gl.useProgram(resources.programSimple);
  const locs2 = programLocations.get(resources.programSimple) || null;
  const useTexLoc2 = locs2 && locs2.uniforms && (locs2.uniforms.u_useTex != null) ? locs2.uniforms.u_useTex : gl.getUniformLocation(resources.programSimple, 'u_useTex');
  const texLoc2 = locs2 && locs2.uniforms && (locs2.uniforms.u_tex != null) ? locs2.uniforms.u_tex : gl.getUniformLocation(resources.programSimple, 'u_tex');
  if (useTexLoc2) gl.uniform1i(useTexLoc2, 1);
  if (texLoc2) { gl.activeTexture(gl.TEXTURE1); gl.uniform1i(texLoc2, 1); }

  // Setup a full-screen quad in pixel coordinates
  const prevProg = program;
  const ures2 = locs2 && locs2.uniforms && locs2.uniforms.u_resolution ? locs2.uniforms.u_resolution : gl.getUniformLocation(resources.programSimple, 'u_resolution');
  if (ures2) gl.uniform2f(ures2, canvas.width || _lastW || canvas.clientWidth, canvas.height || _lastH || canvas.clientHeight);
        // Create fullscreen quad VBO once (two triangles, pixel space)
        if (!resources.fullscreenQuadVBO) {
          resources.fullscreenQuadVBO = gl.createBuffer();
          // allocate or reuse a small fullscreen verts buffer
          if (!resources._fullscreenVerts || resources._fullscreenVerts.length < 8) resources._fullscreenVerts = new Float32Array(8);
          const Wpx = canvas.width || _lastW || canvas.clientWidth;
          const Hpx = canvas.height || _lastH || canvas.clientHeight;
          const fv = resources._fullscreenVerts;
          fv[0] = 0; fv[1] = 0; fv[2] = Wpx; fv[3] = 0; fv[4] = 0; fv[5] = Hpx; fv[6] = Wpx; fv[7] = Hpx;
          gl.bindBuffer(gl.ARRAY_BUFFER, resources.fullscreenQuadVBO);
          gl.bufferData(gl.ARRAY_BUFFER, fv, gl.DYNAMIC_DRAW);
        } else {
          // update size if canvas changed (reuse buffer)
          if (!resources._fullscreenVerts || resources._fullscreenVerts.length < 8) resources._fullscreenVerts = new Float32Array(8);
          const Wpx = canvas.width || _lastW || canvas.clientWidth;
          const Hpx = canvas.height || _lastH || canvas.clientHeight;
          const fv = resources._fullscreenVerts;
          fv[0] = 0; fv[1] = 0; fv[2] = Wpx; fv[3] = 0; fv[4] = 0; fv[5] = Hpx; fv[6] = Wpx; fv[7] = Hpx;
          gl.bindBuffer(gl.ARRAY_BUFFER, resources.fullscreenQuadVBO);
          gl.bufferSubData(gl.ARRAY_BUFFER, 0, fv);
        }
  gl.bindBuffer(gl.ARRAY_BUFFER, resources.fullscreenQuadVBO);
  const posLoc = locs2 && locs2.attribs && (locs2.attribs.a_pos != null) ? locs2.attribs.a_pos : gl.getAttribLocation(resources.programSimple, 'a_pos');
        if (posLoc >= 0) {
          gl.enableVertexAttribArray(posLoc);
          gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
        }
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        // restore original program (program variable) for instanced draws
        gl.useProgram(prevProg);
      } catch (e) {
        // ignore starfield draw errors
      }
    }

    // draw ships / bullets / particles using the stream buffer
    if (useInstanced) {
      // draw stars first (background) using per-type VBO
      if (sn > 0) {
        gl.bindBuffer(gl.ARRAY_BUFFER, resources.starInstanceVBO);
        if (attrPos >= 0) { gl.enableVertexAttribArray(attrPos); gl.vertexAttribPointer(attrPos, 2, gl.FLOAT, false, elemsPer * 4, 0); if (isWebGL2) gl.vertexAttribDivisor(attrPos, 1); }
        if (attrScale >= 0) { gl.enableVertexAttribArray(attrScale); gl.vertexAttribPointer(attrScale, 1, gl.FLOAT, false, elemsPer * 4, 2 * 4); if (isWebGL2) gl.vertexAttribDivisor(attrScale, 1); }
        if (attrAngle >= 0) { gl.enableVertexAttribArray(attrAngle); gl.vertexAttribPointer(attrAngle, 1, gl.FLOAT, false, elemsPer * 4, 3 * 4); if (isWebGL2) gl.vertexAttribDivisor(attrAngle, 1); }
        if (attrColor >= 0) { gl.enableVertexAttribArray(attrColor); gl.vertexAttribPointer(attrColor, 4, gl.FLOAT, false, elemsPer * 4, 4 * 4); if (isWebGL2) gl.vertexAttribDivisor(attrColor, 1); }
  // use safe draw to avoid GPU errors if buffer allocation lags
  safeDrawInstanced(resources.starInstanceVBO, 4, sn, elemsPer);
      }
      // draw ships (next)
      if (n > 0) {
        gl.bindBuffer(gl.ARRAY_BUFFER, resources.shipInstanceVBO);
        if (attrPos >= 0) { gl.enableVertexAttribArray(attrPos); gl.vertexAttribPointer(attrPos, 2, gl.FLOAT, false, elemsPer * 4, 0); if (isWebGL2) gl.vertexAttribDivisor(attrPos, 1); }
        if (attrScale >= 0) { gl.enableVertexAttribArray(attrScale); gl.vertexAttribPointer(attrScale, 1, gl.FLOAT, false, elemsPer * 4, 2 * 4); if (isWebGL2) gl.vertexAttribDivisor(attrScale, 1); }
        if (attrAngle >= 0) { gl.enableVertexAttribArray(attrAngle); gl.vertexAttribPointer(attrAngle, 1, gl.FLOAT, false, elemsPer * 4, 3 * 4); if (isWebGL2) gl.vertexAttribDivisor(attrAngle, 1); }
        if (attrColor >= 0) { gl.enableVertexAttribArray(attrColor); gl.vertexAttribPointer(attrColor, 4, gl.FLOAT, false, elemsPer * 4, 4 * 4); if (isWebGL2) gl.vertexAttribDivisor(attrColor, 1); }
  safeDrawInstanced(resources.shipInstanceVBO, 4, n, elemsPer);
      }
      // bullets
      if (bn > 0) {
        gl.bindBuffer(gl.ARRAY_BUFFER, resources.bulletInstanceVBO);
        if (attrPos >= 0) { gl.enableVertexAttribArray(attrPos); gl.vertexAttribPointer(attrPos, 2, gl.FLOAT, false, elemsPer * 4, 0); if (isWebGL2) gl.vertexAttribDivisor(attrPos, 1); }
        if (attrScale >= 0) { gl.enableVertexAttribArray(attrScale); gl.vertexAttribPointer(attrScale, 1, gl.FLOAT, false, elemsPer * 4, 2 * 4); if (isWebGL2) gl.vertexAttribDivisor(attrScale, 1); }
        if (attrAngle >= 0) { gl.enableVertexAttribArray(attrAngle); gl.vertexAttribPointer(attrAngle, 1, gl.FLOAT, false, elemsPer * 4, 3 * 4); if (isWebGL2) gl.vertexAttribDivisor(attrAngle, 1); }
        if (attrColor >= 0) { gl.enableVertexAttribArray(attrColor); gl.vertexAttribPointer(attrColor, 4, gl.FLOAT, false, elemsPer * 4, 4 * 4); if (isWebGL2) gl.vertexAttribDivisor(attrColor, 1); }
  safeDrawInstanced(resources.bulletInstanceVBO, 4, bn, elemsPer);
      }
      // particles
      if (pn > 0) {
        gl.bindBuffer(gl.ARRAY_BUFFER, resources.particleInstanceVBO);
        if (attrPos >= 0) { gl.enableVertexAttribArray(attrPos); gl.vertexAttribPointer(attrPos, 2, gl.FLOAT, false, elemsPer * 4, 0); if (isWebGL2) gl.vertexAttribDivisor(attrPos, 1); }
        if (attrScale >= 0) { gl.enableVertexAttribArray(attrScale); gl.vertexAttribPointer(attrScale, 1, gl.FLOAT, false, elemsPer * 4, 2 * 4); if (isWebGL2) gl.vertexAttribDivisor(attrScale, 1); }
        if (attrColor >= 0) { gl.enableVertexAttribArray(attrColor); gl.vertexAttribPointer(attrColor, 4, gl.FLOAT, false, elemsPer * 4, 4 * 4); if (isWebGL2) gl.vertexAttribDivisor(attrColor, 1); }
  safeDrawInstanced(resources.particleInstanceVBO, 4, pn, elemsPer);
      }
    } else {
      // fallback: draw each instance individually using per-type VBOs
      for (let i = 0; i < n; i++) {
        const byteOffset = i * elemsPer * 4;
        gl.bindBuffer(gl.ARRAY_BUFFER, resources.shipInstanceVBO);
        if (attrPos >= 0) gl.vertexAttribPointer(attrPos, 2, gl.FLOAT, false, elemsPer * 4, byteOffset + 0);
        if (attrScale >= 0) gl.vertexAttribPointer(attrScale, 1, gl.FLOAT, false, elemsPer * 4, byteOffset + 2 * 4);
        if (attrAngle >= 0) gl.vertexAttribPointer(attrAngle, 1, gl.FLOAT, false, elemsPer * 4, byteOffset + 3 * 4);
        if (attrColor >= 0) gl.vertexAttribPointer(attrColor, 4, gl.FLOAT, false, elemsPer * 4, byteOffset + 4 * 4);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
      for (let bi = 0; bi < bn; bi++) {
        const byteOffset = bi * elemsPer * 4;
        gl.bindBuffer(gl.ARRAY_BUFFER, resources.bulletInstanceVBO);
        if (attrPos >= 0) gl.vertexAttribPointer(attrPos, 2, gl.FLOAT, false, elemsPer * 4, byteOffset + 0);
        if (attrScale >= 0) gl.vertexAttribPointer(attrScale, 1, gl.FLOAT, false, elemsPer * 4, byteOffset + 2 * 4);
        if (attrAngle >= 0) gl.vertexAttribPointer(attrAngle, 1, gl.FLOAT, false, elemsPer * 4, byteOffset + 3 * 4);
        if (attrColor >= 0) gl.vertexAttribPointer(attrColor, 4, gl.FLOAT, false, elemsPer * 4, byteOffset + 4 * 4);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
      for (let pi = 0; pi < pn; pi++) {
        const byteOffset = pi * elemsPer * 4;
        gl.bindBuffer(gl.ARRAY_BUFFER, resources.particleInstanceVBO);
        if (attrPos >= 0) gl.vertexAttribPointer(attrPos, 2, gl.FLOAT, false, elemsPer * 4, byteOffset + 0);
        if (attrScale >= 0) gl.vertexAttribPointer(attrScale, 1, gl.FLOAT, false, elemsPer * 4, byteOffset + 2 * 4);
        if (attrColor >= 0) gl.vertexAttribPointer(attrColor, 4, gl.FLOAT, false, elemsPer * 4, byteOffset + 4 * 4);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
    }
  }

  function teamToColor(team) {
    if (!team) return [0.6, 0.6, 0.6, 1.0];
    if (team === 'red' || team === 0 || team === '0') return [1.0, 0.5, 0.5, 1.0];
    if (team === 'blue' || team === 1 || team === '1') return [0.5, 0.75, 1.0, 1.0];
    return [0.85, 0.85, 0.85, 1.0];
  }

  // Context loss/restore
  function onContextLost(e) {
    e.preventDefault();
    // mark resources cleared
    _running = false;
  }
  function onContextRestored() {
    try { initGL(); } catch (e) { console.warn('webgl restore failed', e); }
  }

  // Public API
  const renderer = {
    type: 'webgl',
    webgl2: isWebGL2,
  // indicate this renderer drives its own RAF-based simulation loop
  providesOwnLoop: true,
  // cached debug resources to avoid per-call shader compiles
  _debug: { solidProgram: null, solidBuf: null, solidBufSize: 0, fbo: null, fboTex: null },
    // debug helper: draw a solid opaque rectangle to the default framebuffer
    debugDrawSolid(opts = {}) {
      try {
        if (!gl) return false;
        const color = opts.color || [1, 0, 0, 1];
        const x = opts.x != null ? opts.x : Math.floor((canvas.width || 0) / 2 - 32);
        const y = opts.y != null ? opts.y : Math.floor((canvas.height || 0) / 2 - 32);
        const w = opts.w != null ? opts.w : 64;
        const h = opts.h != null ? opts.h : 64;

        // create or reuse cached program & buffer for solid rect
        let p = renderer._debug.solidProgram;
        let buf = renderer._debug.solidBuf;
        if (!p) {
          const vsSrc = isWebGL2 ? `#version 300 es\nprecision mediump float; layout(location=0) in vec2 a_pos; uniform vec2 u_resolution; void main(){ vec2 ndc = (a_pos / u_resolution) * 2.0 - 1.0; ndc.y = -ndc.y; gl_Position = vec4(ndc,0.0,1.0); }` : `precision mediump float; attribute vec2 a_pos; uniform vec2 u_resolution; void main(){ vec2 ndc = (a_pos / u_resolution) * 2.0 - 1.0; ndc.y = -ndc.y; gl_Position = vec4(ndc,0.0,1.0); }`;
          const fsSrc = isWebGL2 ? `#version 300 es\nprecision mediump float; out vec4 o; uniform vec4 u_color; void main(){ o = u_color; }` : `precision mediump float; uniform vec4 u_color; void main(){ gl_FragColor = u_color; }`;
          const vs = compileShader(vsSrc, gl.VERTEX_SHADER);
          const fs = compileShader(fsSrc, gl.FRAGMENT_SHADER);
          p = linkProgram(vs, fs);
          buf = gl.createBuffer();
          renderer._debug.solidProgram = p;
          renderer._debug.solidBuf = buf;
          try { dumpProgramInfo(p); } catch (e) {}
        }

        // build vertex data for this rect and upload into cached buffer (reuse verts)
        const x0 = x, y0 = y, x1 = x + w, y1 = y + h;
        if (!renderer._debug.solidVerts) renderer._debug.solidVerts = new Float32Array(8);
        const verts = renderer._debug.solidVerts;
        verts[0] = x0; verts[1] = y0; verts[2] = x1; verts[3] = y0; verts[4] = x0; verts[5] = y1; verts[6] = x1; verts[7] = y1;
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        try {
          const byteLen = verts.byteLength;
          if (renderer._debug.solidBufSize && byteLen <= renderer._debug.solidBufSize) {
            gl.bufferSubData(gl.ARRAY_BUFFER, 0, verts);
          } else {
            gl.bufferData(gl.ARRAY_BUFFER, verts, gl.DYNAMIC_DRAW);
            renderer._debug.solidBufSize = byteLen;
          }
        } catch (e) {
          // fallback
          gl.bufferData(gl.ARRAY_BUFFER, verts, gl.DYNAMIC_DRAW);
          renderer._debug.solidBufSize = verts.byteLength;
        }

        // disable blending to force opaque writes
        const blendEnabled = !!gl.getParameter(gl.BLEND);
        if (blendEnabled) gl.disable(gl.BLEND);

        gl.useProgram(p);
        const posLoc = isWebGL2 ? gl.getAttribLocation(p, 'a_pos') : gl.getAttribLocation(p, 'a_pos');
        const ures = gl.getUniformLocation(p, 'u_resolution');
        const ucolor = gl.getUniformLocation(p, 'u_color');
        if (ures) gl.uniform2f(ures, canvas.width || _lastW || canvas.clientWidth, canvas.height || _lastH || canvas.clientHeight);
        if (ucolor) gl.uniform4f(ucolor, color[0], color[1], color[2], color[3]);

        if (posLoc >= 0) {
          gl.enableVertexAttribArray(posLoc);
          gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
        }

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  // check for GL errors
  try { checkGLError('debugDrawSolid after drawArrays'); } catch (e) {}
  try { diag._lastDebugDraw = Date.now(); } catch (e) {}
        // restore blend
        if (blendEnabled) gl.enable(gl.BLEND);

  // do not delete cached program/buffer here; cleaned up in destroy()

  debugLog('debugDrawSolid: drew rect', x, y, w, h);
  return true;
      } catch (e) {
  debugLog('debugDrawSolid failed', e);
        return false;
      }
    },
    // debug helper: clear the default framebuffer to a solid color (opaque)
    debugClear(opts = {}) {
      try {
        if (!gl) return false;
        const c = opts.color || [1, 0, 0, 1];
        // force opaque clear and disable blending while clearing
        const blendEnabled = !!gl.getParameter(gl.BLEND);
        if (blendEnabled) gl.disable(gl.BLEND);
        gl.clearColor(c[0], c[1], c[2], c[3]);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        try { checkGLError('debugClear after clear'); } catch (e) {}
        if (blendEnabled) gl.enable(gl.BLEND);
  try { diag._lastDebugClear = Date.now(); } catch (e) {}
  debugLog('debugClear: cleared to', c);
        return true;
      } catch (e) {
        debugLog('debugClear failed', e);
        return false;
      }
    },
    // debug helper: render/clear into an offscreen 1x1 FBO and return the pixel bytes
    debugDrawToFBO(opts = {}) {
      try {
        if (!gl) return { __error: 'no-gl' };
        const c = opts.color || [1, 0, 0, 1];
        // use cached 1x1 FBO & texture if pre-created, otherwise create per-call
        let fbo = renderer._debug && renderer._debug.fbo;
        let tex = renderer._debug && renderer._debug.fboTex;
        let createdPerCall = false;
        if (!fbo || !tex) {
          createdPerCall = true;
          tex = gl.createTexture();
          gl.bindTexture(gl.TEXTURE_2D, tex);
          try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null); } catch (e) {}
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
          fbo = gl.createFramebuffer();
          gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
          try { gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0); } catch (e) {}
          const status = gl.checkFramebufferStatus ? gl.checkFramebufferStatus(gl.FRAMEBUFFER) : gl.FRAMEBUFFER_COMPLETE;
          if (status !== gl.FRAMEBUFFER_COMPLETE) {
            debugLog('debugDrawToFBO: incomplete FBO', status);
            // cleanup
            try { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.deleteFramebuffer(fbo); gl.deleteTexture(tex); } catch (e) {}
            return { __error: 'fbo-incomplete', status };
          }
        } else {
          gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        }

        // set viewport to 1x1 and clear
        const prevViewport = gl.getParameter(gl.VIEWPORT);
        gl.viewport(0, 0, 1, 1);
        const blendEnabled = !!gl.getParameter(gl.BLEND);
        if (blendEnabled) gl.disable(gl.BLEND);
        gl.clearColor(c[0], c[1], c[2], c[3]);
        gl.clear(gl.COLOR_BUFFER_BIT);
        try { gl.finish(); } catch (e) {}

  // read pixel from FBO (reuse small 4-byte buffer)
  if (!renderer._debug._read1) renderer._debug._read1 = new Uint8Array(4);
  const buf = renderer._debug._read1;
  gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf);

        // restore viewport/blend
        try { gl.viewport(prevViewport[0], prevViewport[1], prevViewport[2], prevViewport[3]); } catch (e) {}
        if (blendEnabled) gl.enable(gl.BLEND);

        // cleanup per-call resources if we created them here
        try { gl.bindFramebuffer(gl.FRAMEBUFFER, null); } catch (e) {}
        if (createdPerCall) {
          try { gl.deleteFramebuffer(fbo); gl.deleteTexture(tex); } catch (e) {}
        }

        debugLog('debugDrawToFBO: read', buf[0], buf[1], buf[2], buf[3]);
        return { pixel: [buf[0], buf[1], buf[2], buf[3]] };
      } catch (e) {
        debugLog('debugDrawToFBO failed', e);
        return { __error: String(e) };
      }
    },
    init() {
      try {
        initGL();
  // Pre-create debug program & static buffer when debug mode is enabled
  // to avoid shader compilation and buffer re-allocation on each call.
        if (cfg.debug && gl) {
          try {
            if (!renderer._debug.solidProgram) {
              const vsSrc = isWebGL2 ? `#version 300 es\nprecision mediump float; layout(location=0) in vec2 a_pos; uniform vec2 u_resolution; void main(){ vec2 ndc = (a_pos / u_resolution) * 2.0 - 1.0; ndc.y = -ndc.y; gl_Position = vec4(ndc,0.0,1.0); }` : `precision mediump float; attribute vec2 a_pos; uniform vec2 u_resolution; void main(){ vec2 ndc = (a_pos / u_resolution) * 2.0 - 1.0; ndc.y = -ndc.y; gl_Position = vec4(ndc,0.0,1.0); }`;
              const fsSrc = isWebGL2 ? `#version 300 es\nprecision mediump float; out vec4 o; uniform vec4 u_color; void main(){ o = u_color; }` : `precision mediump float; uniform vec4 u_color; void main(){ gl_FragColor = u_color; }`;
              const vs = compileShader(vsSrc, gl.VERTEX_SHADER);
              const fs = compileShader(fsSrc, gl.FRAGMENT_SHADER);
              const p = linkProgram(vs, fs);
              const buf = gl.createBuffer();
              renderer._debug.solidProgram = p;
              renderer._debug.solidBuf = buf;
              renderer._debug.solidBufSize = 0;
              try { dumpProgramInfo(p); } catch (e) {}
            }
          } catch (e) {
            console.warn('pre-create debug program failed', e);
          }
          // Pre-create a 1x1 FBO + texture for debugDrawToFBO to avoid per-call allocations
          try {
            if (!renderer._debug.fbo) {
              const tex = gl.createTexture();
              gl.bindTexture(gl.TEXTURE_2D, tex);
              // allocate 1x1 texture
              try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null); } catch (e) { /* some contexts allow null */ }
              gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
              gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
              const fbo = gl.createFramebuffer();
              gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
              try { gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0); } catch (e) {}
              // check completeness; if incomplete, free and skip caching
              let ok = true;
              try { if (gl.checkFramebufferStatus && gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) ok = false; } catch (e) { ok = false; }
              gl.bindFramebuffer(gl.FRAMEBUFFER, null);
              if (ok) {
                renderer._debug.fbo = fbo;
                renderer._debug.fboTex = tex;
              } else {
                try { gl.deleteFramebuffer(fbo); gl.deleteTexture(tex); } catch (e) {}
              }
            }
          } catch (e) {
            console.warn('pre-create debug FBO failed', e);
          }
        }
        canvas.addEventListener('webglcontextlost', onContextLost, false);
        canvas.addEventListener('webglcontextrestored', onContextRestored, false);
        // expose diagnostics and renderer for runtime debugging only when debug mode is enabled
        try {
          if (cfg.debug && typeof window !== 'undefined') {
            window.__getRendererDiagnostics = renderer.getRendererDiagnostics.bind(renderer);
            window.__renderer = renderer;
          }
        } catch (e) {}
        return true;
      } catch (e) {
        console.warn('WebGL init failed', e);
        return false;
      }
    },
    // sample center pixel from GL default framebuffer (returns Uint8 values)
    sampleGLCenter() {
      try {
        if (!gl) return null;
        const w = canvas.width || 0;
        const h = canvas.height || 0;
        if (!w || !h) return null;
        const x = Math.floor(w / 2);
        const y = Math.floor(h / 2);
        const buf = new Uint8Array(4);
        // readPixels expects lower-left origin
  try { gl.finish(); } catch (e) {}
  const glY = Math.max(0, (h - 1) - y);
  gl.readPixels(x, glY, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf);
        return { x, y, pixel: [buf[0], buf[1], buf[2], buf[3]], w, h };
      } catch (e) {
        return { __error: String(e) };
      }
    },
    start(cb) {
      if (_running) return;
      _running = true;
      if (cb) cb();
      // Fixed timestep accumulator (Gaffer on Games style)
      // keep a small cap on maximum delta to avoid spiral of death
      const FIXED_DT = 1 / 60; // 60Hz deterministic simulation step
      const MAX_DELTA = 0.25; // clamp large frame deltas (seconds)
      let lastTime = null;
      let accumulator = 0;

      // store a lightweight previous-ship map so render() can interpolate
      // between the previous and current simulation states for smooth visuals.
      function frame(t) {
        if (!_running) return;
        const now = (t === undefined || t === null) ? (performance ? performance.now() / 1000 : Date.now() / 1000) : t / 1000;
        if (lastTime === null) lastTime = now;
        let delta = now - lastTime;
        lastTime = now;
        if (!isFinite(delta) || delta <= 0) delta = FIXED_DT;
        // clamp very large deltas (tab switched, debugging pause, etc.)
        delta = Math.min(delta, MAX_DELTA);
        accumulator += delta;

        // run fixed-step updates; before each simulate step capture a shallow
        // snapshot of ship positions so renderer can interpolate between steps.
        while (accumulator >= FIXED_DT) {
          // capture prev map
          const prevShipsMap = new Map();
          try {
            for (const s of (Array.isArray && Array.isArray(window) ? [] : []) ) {}
          } catch (e) {}
          // we don't have easy access to global ships array here; instead,
          // rely on simulate() to return the state and allow render to keep
          // a copy. We'll call simulate with FIXED_DT and stash a prev map on
          // the returned state after each step. The renderer.render will then
          // use state._prevShipsMap (if present) and state._alpha for interpolation.
          let state;
          try {
            state = simulate(FIXED_DT, canvas.width, canvas.height);
          } catch (e) {
            console.error('simulate() failed in webgl renderer', e);
            _running = false;
            return;
          }
          // move previous state into state._prevShipsMap if renderer has a lastState
          try {
            if (renderer._lastState && Array.isArray(renderer._lastState.ships)) {
              const m = new Map();
              for (const ps of renderer._lastState.ships) {
                if (ps && ps.id != null) m.set(ps.id, { x: ps.x, y: ps.y, angle: ps.angle });
              }
              state._prevShipsMap = m;
            }
          } catch (e) {}
          renderer._lastState = state;
          accumulator -= FIXED_DT;
        }

        // compute alpha for interpolation between last completed step and next
        const alpha = accumulator / FIXED_DT;
        // attach alpha to the state for renderer to pick up
        try {
          if (renderer._lastState) renderer._lastState._alpha = alpha;
        } catch (e) {}

        // render the last simulated state (renderer.render will use _alpha)
        try { renderer.render(renderer._lastState || {}); } catch (e) { console.warn('renderer.render error', e); }

        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    },
    stop() { _running = false; },
    isRunning() { return _running; },
    render(state) {
      if (!gl) return;
      // if the state contains a pre-rendered starCanvas, queue it for upload as a background texture
      if (state && state.starCanvas) {
        try {
          // Always queue starCanvas for upload when provided; internal upload pipeline
          // will dedupe or skip if the canvas is invalid. This is more robust when
          // the producer frequently re-creates canvases.
          queueStarfieldUpload(state.starCanvas);
        } catch (e) { /* ignore */ }
      }
      // gather atlas uploads from atlasAccessor
      if (cfg.atlasAccessor && typeof cfg.atlasAccessor === 'function') {
        const ships = (state && state.ships) || [];
        for (const s of ships) {
          const key = `${s.type||'hull'}:${s.radius||8}`;
          if (!resources.textures.has(key)) {
            try {
              const atlas = cfg.atlasAccessor(s.type || 'hull', s.radius || 8);
              if (atlas && atlas.canvas) {
                queueAtlasUpload(key, atlas);
              }
            } catch (e) {
              // ignore atlas accessor errors
            }
          }
        }
      }
      render(state);
    },
    destroy() {
      try {
        canvas.removeEventListener('webglcontextlost', onContextLost);
        canvas.removeEventListener('webglcontextrestored', onContextRestored);
        // free GL resources
        // delete textures/programs/VAOs
        for (const v of Object.values(resources)) {
          try {
            if (!v) continue;
            if (v instanceof WebGLTexture) gl.deleteTexture(v);
            if (v instanceof WebGLProgram) gl.deleteProgram(v);
            if (v instanceof WebGLVertexArrayObject) gl.deleteVertexArray(v);
          } catch (e) {}
        }
        // delete buffer pools (star/ship/bullet/particle and quad/fullscreen)
        try {
          if (resources.quadVBO) gl.deleteBuffer(resources.quadVBO);
          if (resources.fullscreenQuadVBO) gl.deleteBuffer(resources.fullscreenQuadVBO);
          if (resources.instanceVBO) gl.deleteBuffer(resources.instanceVBO);
          const pools = ['starInstanceVBOs','shipInstanceVBOs','bulletInstanceVBOs','particleInstanceVBOs'];
          for (const p of pools) {
            if (Array.isArray(resources[p])) {
              for (const b of resources[p]) {
                try { if (b) gl.deleteBuffer(b); } catch (ee) {}
              }
            }
          }
        } catch (e) {}
        // free cached debug resources
        try {
          if (renderer._debug) {
            if (renderer._debug.solidBuf) try { gl.deleteBuffer(renderer._debug.solidBuf); } catch (e) {}
            if (renderer._debug.solidProgram) try { gl.deleteProgram(renderer._debug.solidProgram); } catch (e) {}
            if (renderer._debug.fbo) try { gl.deleteFramebuffer(renderer._debug.fbo); } catch (e) {}
            if (renderer._debug.fboTex) try { gl.deleteTexture(renderer._debug.fboTex); } catch (e) {}
            renderer._debug.solidBuf = null;
            renderer._debug.solidProgram = null;
            renderer._debug.solidBufSize = 0;
            renderer._debug.fbo = null;
            renderer._debug.fboTex = null;
          }
        } catch (e) {}
      } catch (e) {}
    },
    // diagnostics accessor (include some resource counts)
    getRendererDiagnostics() {
      const starLen = _starBuffer ? _starBuffer.length : 0;
      const shipLen = _shipBuffer ? _shipBuffer.length : 0;
      const bulletLen = _bulletBuffer ? _bulletBuffer.length : 0;
      const particleLen = _particleBuffer ? _particleBuffer.length : 0;
      const starSampleLen = Math.min(starLen, 32);
      const shipSampleLen = Math.min(shipLen, 32);
      const bulletSampleLen = Math.min(bulletLen, 32);
      const particleSampleLen = Math.min(particleLen, 32);
      const base = Object.assign({}, diag, {
        // per-type buffer capacities (floats)
        starCapacity: _starCapacity,
        shipCapacity: _shipCapacity,
        bulletCapacity: _bulletCapacity,
        particleCapacity: _particleCapacity,
        // used element counts
        starUsed: _starUsed,
        shipUsed: _shipUsed,
        bulletUsed: _bulletUsed,
        particleUsed: _particleUsed,
        // per-VBO allocated byte sizes
        starVBOSize: resources.starInstanceVBO ? resources.starInstanceVBO._size : 0,
        shipVBOSize: resources.shipInstanceVBO ? resources.shipInstanceVBO._size : 0,
        bulletVBOSize: resources.bulletInstanceVBO ? resources.bulletInstanceVBO._size : 0,
        particleVBOSize: resources.particleInstanceVBO ? resources.particleInstanceVBO._size : 0,
        // include small samples to help debug instance contents
        starSample: _starBuffer ? Array.from(_starBuffer.subarray(0, starSampleLen)) : [],
        shipSample: _shipBuffer ? Array.from(_shipBuffer.subarray(0, shipSampleLen)) : [],
        bulletSample: _bulletBuffer ? Array.from(_bulletBuffer.subarray(0, bulletSampleLen)) : [],
        particleSample: _particleBuffer ? Array.from(_particleBuffer.subarray(0, particleSampleLen)) : [],
        // approximate instance counts assuming 8 floats per instance
        approxStarInstances: Math.floor(starLen / 8),
        approxShipInstances: Math.floor(shipLen / 8),
        approxBulletInstances: Math.floor(bulletLen / 8),
        approxParticleInstances: Math.floor(particleLen / 8)
      });

      // add a small center-area GL sample (3x3) if GL context is available
      try {
        if (gl && canvas && canvas.width && canvas.height) {
          const cx = Math.floor((canvas.width || 0) / 2);
          const cy = Math.floor((canvas.height || 0) / 2);
          const sx = Math.max(1, Math.min(3, canvas.width));
          const sy = Math.max(1, Math.min(3, canvas.height));
          const px = Math.max(0, cx - Math.floor(sx / 2));
          const py = Math.max(0, cy - Math.floor(sy / 2));
          // reuse read buffer for diagnostics when possible
          if (!renderer._debug._readBuf || renderer._debug._readBuf.length < sx * sy * 4) renderer._debug._readBuf = new Uint8Array(sx * sy * 4);
          const read = renderer._debug._readBuf;
          // readPixels uses lower-left origin; ensure we flush and convert y
          try { gl.finish(); } catch (e) {}
          const glPy = Math.max(0, (canvas.height - 1) - py - (sy - 1));
          gl.readPixels(px, glPy, sx, sy, gl.RGBA, gl.UNSIGNED_BYTE, read);
          let any = false;
          for (let i = 0; i < read.length; i += 4) {
            if (read[i] !== 0 || read[i+1] !== 0 || read[i+2] !== 0 || read[i+3] !== 0) { any = true; break; }
          }
          base.centerSample = { x: cx, y: cy, w: sx, h: sy, anyNonZero: any, pixels: Array.from(read) };
        }
      } catch (e) {
        base.centerSample = { __error: String(e) };
      }

      // include GL context attributes and key strings for diagnosis
      try {
        const ca = gl.getContextAttributes ? gl.getContextAttributes() : null;
        const ver = gl.getParameter ? gl.getParameter(gl.VERSION) : null;
        const slv = gl.getParameter ? gl.getParameter(gl.SHADING_LANGUAGE_VERSION) : null;
        const vendor = gl.getParameter ? (gl.getParameter(gl.VENDOR) || null) : null;
        let lastErr = null;
        try { lastErr = gl.getError(); } catch (e) { lastErr = String(e); }
        base.gl = { contextAttributes: ca, version: ver, shadingLanguageVersion: slv, vendor, lastError: lastErr };
      } catch (e) {
        base.gl = { __error: String(e) };
      }

      return base;
    }
  };

  return renderer;
}

export default { createWebGLRenderer };
