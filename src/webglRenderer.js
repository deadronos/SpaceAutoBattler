// Minimal WebGL renderer stub implementing createWebGLRenderer per spec.
// Lightweight WebGL renderer implementation following spec-design-webgl-renderer.md
// This implementation focuses on correctness and graceful degradation.
export function createWebGLRenderer(canvas, opts = {}) {
  // Options defaults
  const cfg = Object.assign({ webgl2: true, maxDevicePixelRatio: 1.5, maxUploadsPerFrame: 2, atlasUseMipmaps: false, atlasMaxSize: 2048 }, opts);

  let gl = null;
  let isWebGL2 = false;
  try {
    if (cfg.webgl2) {
      gl = canvas.getContext('webgl2', { antialias: true, alpha: true });
      isWebGL2 = !!gl;
    }
    if (!gl) {
      gl = canvas.getContext('webgl', { antialias: true, alpha: true }) || canvas.getContext('experimental-webgl');
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

  // GL resource holders
  const resources = {
    programInstanced: null,
    programSimple: null,
    quadVBO: null,
  // legacy per-type VBOs remain but we'll use streamInstanceVBO for uploads
  instanceVBO: null,
  streamInstanceVBO: null,
    ibo: null,
    vao: null,
    textures: new Map(), // key -> { tex, size, baseRadius, canvas }
  };

  let _running = false;
  let _lastW = 0, _lastH = 0;

  // Typed array buffers reused across frames
  let _instanceBuffer = null;
  let _instanceCapacity = 0;

  let _pendingAtlasUploads = [];
  // Reusable per-type instance buffers to avoid per-frame allocations
  let _bulletBuffer = null;
  let _bulletCapacity = 0;
  let _particleBuffer = null;
  let _particleCapacity = 0;
  // Single streaming buffer for all dynamic instances (ships + bullets + particles)
  let _streamBuffer = null;
  let _streamCapacity = 0;

  // Helper: compile shader
  function compileShader(src, type) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const msg = gl.getShaderInfoLog(s);
      gl.deleteShader(s);
      throw new Error('Shader compile error: ' + msg);
    }
    return s;
  }

  // Helper: link program
  function linkProgram(vs, fs) {
    const p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      const msg = gl.getProgramInfoLog(p);
      gl.deleteProgram(p);
      throw new Error('Program link error: ' + msg);
    }
    return p;
  }

  // Simple instanced vertex/fragment shaders (support texture optionality via uniform)
  const vsInstanced = `#version 300 es
  precision mediump float;
  layout(location=0) in vec2 a_quadPos; // -0.5..0.5 unit quad
  layout(location=1) in vec2 a_pos; // instance x,y
  layout(location=2) in float a_scale; // instance scale (radius)
  layout(location=3) in float a_angle; // instance angle
  layout(location=4) in vec4 a_color; // instance color
  out vec2 v_uv;
  out vec4 v_color;
  uniform vec2 u_resolution;
  void main() {
    // rotate & scale quad
    float c = cos(a_angle);
    float s = sin(a_angle);
    vec2 p = vec2(
      a_quadPos.x * a_scale,
      a_quadPos.y * a_scale
    );
    vec2 rp = vec2(p.x * c - p.y * s, p.x * s + p.y * c);
    vec2 screen = (a_pos + rp);
    // convert to clip
    vec2 ndc = (screen / u_resolution) * 2.0 - 1.0;
    ndc.y = -ndc.y; // flip Y
    gl_Position = vec4(ndc, 0.0, 1.0);
    v_uv = a_quadPos + 0.5;
    v_color = a_color;
  }
`;

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
      float alpha = smoothstep(0.5, 0.48, r);
      outColor = vec4(v_color.rgb, v_color.a * alpha);
    }
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
      float alpha = smoothstep(0.5, 0.48, r);
      gl_FragColor = vec4(v_color.rgb, v_color.a * alpha);
    }
  }
`;

  // Create programs (deferred until init)

  function initPrograms() {
    // instanced program (WebGL2)
    if (isWebGL2) {
      const vs = compileShader(vsInstanced, gl.VERTEX_SHADER);
      const fs = compileShader(fsInstanced, gl.FRAGMENT_SHADER);
      resources.programInstanced = linkProgram(vs, fs);
    }
    // simple program (works on WebGL1 and WebGL2)
    const vs2 = compileShader(isWebGL2 ? `#version 300 es\n` + vsInstanced : vsSimple, isWebGL2 ? gl.VERTEX_SHADER : gl.VERTEX_SHADER);
    const fs2 = compileShader(isWebGL2 ? `#version 300 es\n` + fsInstanced : fsSimple, isWebGL2 ? gl.FRAGMENT_SHADER : gl.FRAGMENT_SHADER);
    resources.programSimple = linkProgram(vs2, fs2);
  }

  // Create/ensure buffers and VAO
  function initBuffers() {
    // quad VBO: two triangles covering -0.5..0.5
    const quadVerts = new Float32Array([-0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5]);
    resources.quadVBO = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, resources.quadVBO);
    gl.bufferData(gl.ARRAY_BUFFER, quadVerts, gl.STATIC_DRAW);

  // instance VBO reserved; will be dynamic (ships)
  resources.instanceVBO = gl.createBuffer();
  _instanceCapacity = 0;
  _instanceBuffer = null;
  resources.instanceVBO._size = 0;
  resources.streamInstanceVBO = gl.createBuffer();
  resources.streamInstanceVBO._size = 0;

  _bulletBuffer = null;
  _bulletCapacity = 0;
  _particleBuffer = null;
  _particleCapacity = 0;

  _streamBuffer = null;
  _streamCapacity = 0;

  // separate instance buffers for bullets and particles
  resources.bulletInstanceVBO = gl.createBuffer();
  resources.particleInstanceVBO = gl.createBuffer();
  resources.bulletInstanceVBO._size = 0;
  resources.particleInstanceVBO._size = 0;

    // VAO for WebGL2
    if (isWebGL2 && gl.createVertexArray) {
      resources.vao = gl.createVertexArray();
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
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
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
        // downscale if necessary
        let canvasSrc = atlas.canvas;
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

  // Prepare ships
  const ships = state.ships || [];
  const n = ships.length;

  // Build instance buffer: per-instance: x,y,scale,angle,r,g,b,a
  const elemsPer = 8; // vec2 + scale + angle + vec4 color
  // We no longer build a separate _instanceBuffer for ships; ships will be written
  // directly into the streaming buffer below to avoid an extra copy.

    // We'll build a single streaming buffer for ships, bullets, and particles contiguously
    const bullets = state.bullets || [];
    const bn = bullets.length;
    const particles = state.particles || [];
    const pn = particles.length;

    const shipElems = n * elemsPer;
    const bulletElems = bn * elemsPer;
    const particleElems = pn * elemsPer;
    const totalElems = shipElems + bulletElems + particleElems;

    if (_streamCapacity < totalElems) {
      // grow capacity (elements)
      let cap = Math.max(4 * elemsPer, _streamCapacity || 0);
      while (cap < totalElems) cap *= 2;
      _streamCapacity = cap;
      _streamBuffer = new Float32Array(_streamCapacity);
    }

    // write ships directly into stream buffer at offset 0
    for (let i = 0; i < n; i++) {
      const s = ships[i];
      const base = i * elemsPer;
      _streamBuffer[base + 0] = s.x || 0;
      _streamBuffer[base + 1] = s.y || 0;
      _streamBuffer[base + 2] = (s.radius != null ? s.radius : 8);
      _streamBuffer[base + 3] = (s.angle != null ? s.angle : 0);
      const color = teamToColor(s.team);
      _streamBuffer[base + 4] = color[0];
      _streamBuffer[base + 5] = color[1];
      _streamBuffer[base + 6] = color[2];
      _streamBuffer[base + 7] = color[3];
    }

    // fill bullets directly into stream buffer after ships
    let offset = shipElems;
    for (let i = 0; i < bn; i++) {
      const b = bullets[i];
      const base = offset + i * elemsPer;
      _streamBuffer[base + 0] = b.x || 0;
      _streamBuffer[base + 1] = b.y || 0;
      _streamBuffer[base + 2] = (b.radius != null ? b.radius : 2);
      _streamBuffer[base + 3] = 0;
      _streamBuffer[base + 4] = 1.0; _streamBuffer[base + 5] = 0.85; _streamBuffer[base + 6] = 0.5; _streamBuffer[base + 7] = 1.0;
    }

    // fill particles into stream buffer after bullets
    offset = shipElems + bulletElems;
    for (let i = 0; i < pn; i++) {
      const p = particles[i];
      const base = offset + i * elemsPer;
      _streamBuffer[base + 0] = p.x || 0;
      _streamBuffer[base + 1] = p.y || 0;
      _streamBuffer[base + 2] = (p.size != null ? p.size : 1);
      _streamBuffer[base + 3] = 0;
      const col = parseColor(p.color || '#ffffff');
      _streamBuffer[base + 4] = col[0]; _streamBuffer[base + 5] = col[1]; _streamBuffer[base + 6] = col[2]; _streamBuffer[base + 7] = Math.max(0.2, col[3]);
    }

    // Upload single stream buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, resources.streamInstanceVBO);
    const streamByteLen = totalElems * 4;
    if (!resources.streamInstanceVBO._size || resources.streamInstanceVBO._size < streamByteLen) {
      gl.bufferData(gl.ARRAY_BUFFER, _streamBuffer.byteLength, gl.DYNAMIC_DRAW);
      resources.streamInstanceVBO._size = _streamBuffer.byteLength;
    }
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, _streamBuffer.subarray(0, totalElems));

    // Clear and draw
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Choose program: prefer instanced if available
    const useInstanced = isWebGL2 && resources.programInstanced;
    const program = useInstanced ? resources.programInstanced : resources.programSimple;
    gl.useProgram(program);

    // Set resolution uniform (both shader styles)
    const ures = gl.getUniformLocation(program, 'u_resolution');
    if (ures) gl.uniform2f(ures, _lastW || canvas.clientWidth, _lastH || canvas.clientHeight);

    // bind quad buffer to attribute
    gl.bindBuffer(gl.ARRAY_BUFFER, resources.quadVBO);
    const aQuad = gl.getAttribLocation(program, 'a_quadPos');
    if (aQuad >= 0) {
      gl.enableVertexAttribArray(aQuad);
      gl.vertexAttribPointer(aQuad, 2, gl.FLOAT, false, 0, 0);
      if (isWebGL2) gl.vertexAttribDivisor(aQuad, 0);
    }

    // Bind streaming instance buffer attributes (single buffer containing ships, bullets, particles)
    gl.bindBuffer(gl.ARRAY_BUFFER, resources.streamInstanceVBO);
    const attrPos = gl.getAttribLocation(program, 'a_pos');
    const attrScale = gl.getAttribLocation(program, 'a_scale');
    const attrAngle = gl.getAttribLocation(program, 'a_angle');
    const attrColor = gl.getAttribLocation(program, 'a_color');
    if (attrPos >= 0) {
      gl.enableVertexAttribArray(attrPos);
      gl.vertexAttribPointer(attrPos, 2, gl.FLOAT, false, elemsPer * 4, 0);
      if (isWebGL2) gl.vertexAttribDivisor(attrPos, 1);
    }
    if (attrScale >= 0) {
      gl.enableVertexAttribArray(attrScale);
      gl.vertexAttribPointer(attrScale, 1, gl.FLOAT, false, elemsPer * 4, 2 * 4);
      if (isWebGL2) gl.vertexAttribDivisor(attrScale, 1);
    }
    if (attrAngle >= 0) {
      gl.enableVertexAttribArray(attrAngle);
      gl.vertexAttribPointer(attrAngle, 1, gl.FLOAT, false, elemsPer * 4, 3 * 4);
      if (isWebGL2) gl.vertexAttribDivisor(attrAngle, 1);
    }
    if (attrColor >= 0) {
      gl.enableVertexAttribArray(attrColor);
      gl.vertexAttribPointer(attrColor, 4, gl.FLOAT, false, elemsPer * 4, 4 * 4);
      if (isWebGL2) gl.vertexAttribDivisor(attrColor, 1);
    }

    // Texture binding: if atlasAccessor present and any texture exists, use first texture
    const useTexLoc = gl.getUniformLocation(program, 'u_useTex');
    const texLoc = gl.getUniformLocation(program, 'u_tex');
    let anyTex = resources.textures.size > 0;
    if (useTexLoc) gl.uniform1i(useTexLoc, anyTex ? 1 : 0);
    if (texLoc && anyTex) {
      gl.activeTexture(gl.TEXTURE0);
      // bind first texture available
      const first = resources.textures.values().next().value;
      gl.bindTexture(gl.TEXTURE_2D, first.tex);
      gl.uniform1i(texLoc, 0);
    }

    // draw ships / bullets / particles using the stream buffer
    if (useInstanced) {
      // draw ships (first range)
      if (n > 0) gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, n);
      // bullets: offset in elements -> convert to bytes for attribute pointers by using vertexAttribPointer offsets via binding buffer with base offset using vertexAttribPointer's offset param
      let shipElemsCount = n;
      let bulletElemsCount = bn;
      let particleElemsCount = pn;
      // To draw bullets, we need to point attributes at buffer region after ships.
      const shipByteOffset = 0;
      const bulletByteOffset = shipElemsCount * elemsPer * 4;
      const particleByteOffset = (shipElemsCount + bulletElemsCount) * elemsPer * 4;
      if (bulletElemsCount > 0) {
        // re-specify attribute pointers with byte offsets for bullets
        if (attrPos >= 0) gl.vertexAttribPointer(attrPos, 2, gl.FLOAT, false, elemsPer * 4, bulletByteOffset + 0);
        if (attrScale >= 0) gl.vertexAttribPointer(attrScale, 1, gl.FLOAT, false, elemsPer * 4, bulletByteOffset + 2 * 4);
        if (attrAngle >= 0) gl.vertexAttribPointer(attrAngle, 1, gl.FLOAT, false, elemsPer * 4, bulletByteOffset + 3 * 4);
        if (attrColor >= 0) gl.vertexAttribPointer(attrColor, 4, gl.FLOAT, false, elemsPer * 4, bulletByteOffset + 4 * 4);
        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, bulletElemsCount);
        // restore ships pointers
        if (attrPos >= 0) gl.vertexAttribPointer(attrPos, 2, gl.FLOAT, false, elemsPer * 4, shipByteOffset + 0);
        if (attrScale >= 0) gl.vertexAttribPointer(attrScale, 1, gl.FLOAT, false, elemsPer * 4, shipByteOffset + 2 * 4);
        if (attrAngle >= 0) gl.vertexAttribPointer(attrAngle, 1, gl.FLOAT, false, elemsPer * 4, shipByteOffset + 3 * 4);
        if (attrColor >= 0) gl.vertexAttribPointer(attrColor, 4, gl.FLOAT, false, elemsPer * 4, shipByteOffset + 4 * 4);
      }
      if (particleElemsCount > 0) {
        const pb = particleByteOffset;
        if (attrPos >= 0) gl.vertexAttribPointer(attrPos, 2, gl.FLOAT, false, elemsPer * 4, pb + 0);
        if (attrScale >= 0) gl.vertexAttribPointer(attrScale, 1, gl.FLOAT, false, elemsPer * 4, pb + 2 * 4);
        if (attrColor >= 0) gl.vertexAttribPointer(attrColor, 4, gl.FLOAT, false, elemsPer * 4, pb + 4 * 4);
        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, particleElemsCount);
        // restore ships pointers (already restored after bullets)
      }
    } else {
      // fallback: issue n drawArrays calls (could be optimized)
      for (let i = 0; i < n; i++) {
        // set vertex attribs to point to i-th instance via offset
        const byteOffset = i * elemsPer * 4;
        if (attrPos >= 0) gl.vertexAttribPointer(attrPos, 2, gl.FLOAT, false, elemsPer * 4, 0 + byteOffset);
        if (attrScale >= 0) gl.vertexAttribPointer(attrScale, 1, gl.FLOAT, false, elemsPer * 4, 2 * 4 + byteOffset);
        if (attrAngle >= 0) gl.vertexAttribPointer(attrAngle, 1, gl.FLOAT, false, elemsPer * 4, 3 * 4 + byteOffset);
        if (attrColor >= 0) gl.vertexAttribPointer(attrColor, 4, gl.FLOAT, false, elemsPer * 4, 4 * 4 + byteOffset);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
      // draw bullets fallback: bullets begin after ships in stream buffer
      const shipElemsCount = n;
      for (let bi = 0; bi < bn; bi++) {
        const idx = shipElemsCount + bi;
        const byteOffset = idx * elemsPer * 4;
        if (attrPos >= 0) gl.vertexAttribPointer(attrPos, 2, gl.FLOAT, false, elemsPer * 4, 0 + byteOffset);
        if (attrScale >= 0) gl.vertexAttribPointer(attrScale, 1, gl.FLOAT, false, elemsPer * 4, 2 * 4 + byteOffset);
        if (attrAngle >= 0) gl.vertexAttribPointer(attrAngle, 1, gl.FLOAT, false, elemsPer * 4, 3 * 4 + byteOffset);
        if (attrColor >= 0) gl.vertexAttribPointer(attrColor, 4, gl.FLOAT, false, elemsPer * 4, 4 * 4 + byteOffset);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
      // draw particles fallback: particles begin after ships+bullets
      const particleBase = n + bn;
      for (let pi = 0; pi < pn; pi++) {
        const idx = particleBase + pi;
        const byteOffset = idx * elemsPer * 4;
        if (attrPos >= 0) gl.vertexAttribPointer(attrPos, 2, gl.FLOAT, false, elemsPer * 4, 0 + byteOffset);
        if (attrScale >= 0) gl.vertexAttribPointer(attrScale, 1, gl.FLOAT, false, elemsPer * 4, 2 * 4 + byteOffset);
        if (attrColor >= 0) gl.vertexAttribPointer(attrColor, 4, gl.FLOAT, false, elemsPer * 4, 4 * 4 + byteOffset);
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
    init() {
      try {
        initGL();
        canvas.addEventListener('webglcontextlost', onContextLost, false);
        canvas.addEventListener('webglcontextrestored', onContextRestored, false);
        return true;
      } catch (e) {
        console.warn('WebGL init failed', e);
        return false;
      }
    },
    start(cb) { _running = true; if (cb) cb(); },
    stop() { _running = false; },
    isRunning() { return _running; },
    render(state) {
      if (!gl) return;
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
        for (const v of Object.values(resources)) {
          try {
            if (!v) continue;
            if (v instanceof WebGLTexture) gl.deleteTexture(v);
            if (v instanceof WebGLBuffer) gl.deleteBuffer(v);
            if (v instanceof WebGLProgram) gl.deleteProgram(v);
            if (v instanceof WebGLVertexArrayObject) gl.deleteVertexArray(v);
          } catch (e) {}
        }
      } catch (e) {}
    },
    // diagnostics accessor
    getRendererDiagnostics() { return Object.assign({}, diag); }
  };

  return renderer;
}

export default { createWebGLRenderer };
