// Refactored webglRenderer.js
// - Streamlined shader creation
// - Unified buffer management
// - Simplified instanced drawing path

import { supportsUint32Indices, splitVertexRanges } from './webglUtils.js';

function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const error = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compile error: ${error}`);
  }
  return shader;
}

function createProgram(gl, vsSource, fsSource) {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vsSource);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const error = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`Program link error: ${error}`);
  }
  return program;
}

export function createWebGLRenderer(canvas, options = {}) {
  const {
    webgl2 = false,
    maxDevicePixelRatio = 1.5,
    atlasAccessor = null,
    atlasLODs = [1],
    maxUploadsPerFrame = 2,
    atlasUseMipmaps = false,
    atlasMaxSize = 2048,
  } = options;

  let gl = canvas.getContext(webgl2 ? 'webgl2' : 'webgl');
  if (!gl) return null;

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  const programs = {
    textured: createProgram(gl, `
      attribute vec2 a_pos;
      attribute vec2 a_uv;
      uniform vec2 u_resolution;
      uniform vec2 u_pos;
      uniform vec2 u_scale;
      uniform float u_rotation;
      varying vec2 v_uv;
      void main() {
        vec2 p = a_pos * u_scale;
        float c = cos(u_rotation);
        float s = sin(u_rotation);
        vec2 rp = vec2(p.x * c - p.y * s, p.x * s + p.y * c);
        vec2 pixelPos = u_pos + rp;
        vec2 clip = (pixelPos / u_resolution) * 2.0 - 1.0;
        clip.y = -clip.y;
        gl_Position = vec4(clip, 0.0, 1.0);
        v_uv = a_uv;
      }`, `
      precision mediump float;
      uniform sampler2D u_tex;
      uniform vec4 u_tint;
      varying vec2 v_uv;
      void main() {
        vec4 t = texture2D(u_tex, v_uv);
        gl_FragColor = vec4(t.rgb * u_tint.rgb, t.a * u_tint.a);
      }`),
    batched: createProgram(gl, `
      attribute vec2 a_pos;
      attribute vec2 a_uv;
      uniform vec2 u_resolution;
      varying vec2 v_uv;
      void main() {
        vec2 clip = (a_pos / u_resolution) * 2.0 - 1.0;
        clip.y = -clip.y;
        gl_Position = vec4(clip, 0.0, 1.0);
        v_uv = a_uv;
      }`, `
      precision mediump float;
      uniform sampler2D u_tex;
      uniform vec4 u_tint;
      varying vec2 v_uv;
      void main() {
        vec4 t = texture2D(u_tex, v_uv);
        gl_FragColor = vec4(t.rgb * u_tint.rgb, t.a * u_tint.a);
      }`),
    instanced: webgl2 ? createProgram(gl, `
      #version 300 es
      in vec2 a_pos;
      in vec2 a_uv;
      in vec2 a_off; in vec2 a_scale; in float a_rot; in vec4 a_tint; in float a_shield;
      uniform vec2 u_resolution;
      out vec2 v_uv; out vec4 v_tint; out float v_shield;
      void main() {
        vec2 p = a_pos * a_scale;
        float c = cos(a_rot);
        float s = sin(a_rot);
        vec2 rp = vec2(p.x * c - p.y * s, p.x * s + p.y * c);
        vec2 pixelPos = a_off + rp;
        vec2 clip = (pixelPos / u_resolution) * 2.0 - 1.0;
        clip.y = -clip.y;
        gl_Position = vec4(clip, 0.0, 1.0);
        v_uv = a_uv;
        v_tint = a_tint;
        v_shield = a_shield;
      }
    `, `
      #version 300 es
      precision mediump float;
      uniform sampler2D u_tex;
      in vec2 v_uv; in vec4 v_tint; in float v_shield;
      out vec4 outColor;
      void main() {
        vec4 t = texture(u_tex, v_uv);
        vec3 col = t.rgb * v_tint.rgb;
        // subtle shield tint boost
        col = mix(col, vec3(0.6,0.8,1.0), clamp(v_shield * 0.25, 0.0, 1.0));
        float a = t.a * v_tint.a;
        outColor = vec4(col, a);
      }
    `) : null,
    disc: createProgram(gl, `
      attribute vec2 a_pos;
      attribute vec2 a_uv;
      varying vec2 v_uv;
      uniform vec2 u_resolution;
      uniform vec2 u_pos;
      uniform vec2 u_scale;
      void main() {
        v_uv = a_uv;
        vec2 p = a_pos * u_scale + u_pos;
        vec2 clip = (p / u_resolution) * 2.0 - 1.0;
        clip.y = -clip.y;
        gl_Position = vec4(clip, 0.0, 1.0);
      }`, `
      precision mediump float;
      uniform vec4 u_color;
      varying vec2 v_uv;
      void main() {
        vec2 uv = v_uv;
        vec2 d = uv - vec2(0.5,0.5);
        float dist = length(d) * 2.0;
        float alpha = 1.0 - smoothstep(0.85, 1.0, dist);
        float glow = 0.15 * (1.0 - smoothstep(0.6, 1.2, dist));
        float outA = clamp(u_color.a * alpha + glow * u_color.a, 0.0, 1.0);
        gl_FragColor = vec4(u_color.rgb * outA, outA);
      }`),
  };

  const buffers = {
    quadVBO: gl.createBuffer(),
    quadIBO: gl.createBuffer(),
    batchVBO: gl.createBuffer(),
    batchIBO: gl.createBuffer(),
    instanceVBO: webgl2 ? gl.createBuffer() : null,
  };

  gl.bindBuffer(gl.ARRAY_BUFFER, buffers.quadVBO);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([ -0.5, -0.5, 0, 1, 0.5, -0.5, 1, 1, 0.5, 0.5, 1, 0, -0.5, 0.5, 0, 0 ]), gl.STATIC_DRAW);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.quadIBO);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);

  const textureCache = new Map();
  const uploadQueue = [];
  const queuedCanvases = new Set();

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

  const renderer = {
    type: 'webgl',
    webgl2,
    _supportsUint32Indices: false,
    init() {
      try {
        if (atlasAccessor) {
          ['corvette', 'frigate', 'destroyer', 'carrier', 'fighter'].forEach(type => {
            atlasLODs.forEach(lod => {
              const atlas = atlasAccessor(type, lod);
              if (atlas) ensureTextureForAtlas(atlas);
            });
          });
        }
        return true;
      } catch {
        gl = null;
        return false;
      }
    },
    render(state) {
      if (!gl) return;
      const DPR = Math.min(maxDevicePixelRatio, window.devicePixelRatio || 1);
      const width = canvas.clientWidth * DPR;
      const height = canvas.clientHeight * DPR;
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.clearColor(0.02, 0.02, 0.03, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);

      let uploads = 0;
      while (uploads < maxUploadsPerFrame && uploadQueue.length > 0) {
        const atlas = uploadQueue.shift();
        try {
          doUploadAtlas(atlas);
        } catch (e) {}
        uploads++;
      }

      if (state.bullets) {
        for (const bullet of state.bullets) {
          const color = bullet.team === 0 ? [1.0, 0.35, 0.35, 0.95] : [0.31, 0.62, 1.0, 0.95];
          drawDisc(bullet.x, bullet.y, bullet.radius || 2.2, color);
        }
      }

      if (state.ships) {
        const groups = new Map();
        for (const ship of state.ships) {
          if (!ship.alive) continue;
          let atlas = null;
          try {
            atlas = atlasAccessor ? atlasAccessor(ship.type, ship.radius) : null;
          } catch (e) {
            atlas = null;
          }
          const tint = ship.team === 0 ? [1.0, 0.35, 0.35, 0.96] : [0.31, 0.63, 1.0, 0.96];
          if (!atlas || !atlas.canvas) {
            drawDisc(ship.x, ship.y, ship.radius || 8, tint);
            continue;
          }
          const atlasInfo = ensureTextureForAtlas(atlas);
          if (!atlasInfo || !atlasInfo.tex) {
            drawDisc(ship.x, ship.y, ship.radius || 8, tint);
            continue;
          }
          const key = (atlas.canvas && typeof atlas.canvas.id !== 'undefined') ? atlas.canvas.id : atlas.canvas;
          let entry = groups.get(key);
          if (!entry) {
            entry = { atlasInfo, byTeam: new Map() };
            groups.set(key, entry);
          }
          const teamArr = entry.byTeam.get(ship.team) || [];
          teamArr.push(ship);
          entry.byTeam.set(ship.team, teamArr);
        }

        for (const [canvasKey, entry] of groups.entries()) {
          for (const [team, arr] of entry.byTeam.entries()) {
            const atlasInfo = entry.atlasInfo;
            const totalQuads = arr.length;
            if (totalQuads === 0) continue;
            if (renderer._isWebGL2 && programs.instanced && buffers.instanceVBO) {
              const instanceFloatCount = totalQuads * 10;
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
                inst[io++] = s.x * DPR;
                inst[io++] = s.y * DPR;
                inst[io++] = width;
                inst[io++] = height;
                inst[io++] = s.angle || 0;
                const tint = s.team === 0 ? [1.0, 0.35, 0.35, 0.96] : [0.31, 0.63, 1.0, 0.96];
                inst[io++] = tint[0];
                inst[io++] = tint[1];
                inst[io++] = tint[2];
                inst[io++] = tint[3];
                const shieldFraction = (typeof s.shield === 'number' && typeof s.shieldMax === 'number' && s.shieldMax > 0) ? Math.max(0, Math.min(1, s.shield / s.shieldMax)) : 0.0;
                inst[io++] = shieldFraction;
              }

              gl.useProgram(programs.instanced);
              gl.bindBuffer(gl.ARRAY_BUFFER, buffers.quadVBO);
              if (instancedLoc && instancedLoc.a_pos !== -1) {
                gl.enableVertexAttribArray(instancedLoc.a_pos);
                gl.vertexAttribPointer(instancedLoc.a_pos, 2, gl.FLOAT, false, 16, 0);
                gl.vertexAttribDivisor(instancedLoc.a_pos, 0);
              }
              if (instancedLoc && instancedLoc.a_uv !== -1) {
                gl.enableVertexAttribArray(instancedLoc.a_uv);
                gl.vertexAttribPointer(instancedLoc.a_uv, 2, gl.FLOAT, false, 16, 8);
                gl.vertexAttribDivisor(instancedLoc.a_uv, 0);
              }

              gl.bindBuffer(gl.ARRAY_BUFFER, buffers.instanceVBO);
              const instBytes = inst.byteLength;
              if (instBytes <= renderer._instanceVBOCapacity) {
                gl.bufferSubData(gl.ARRAY_BUFFER, 0, inst);
              } else {
                let newCap = Math.max(instBytes, renderer._instanceVBOCapacity * 2 || instBytes);
                gl.bufferData(gl.ARRAY_BUFFER, newCap, gl.DYNAMIC_DRAW);
                gl.bufferSubData(gl.ARRAY_BUFFER, 0, inst);
                renderer._instanceVBOCapacity = newCap;
              }
              const stride = 10 * 4;
              if (instancedLoc && instancedLoc.a_offset !== -1) {
                gl.enableVertexAttribArray(instancedLoc.a_offset);
                gl.vertexAttribPointer(instancedLoc.a_offset, 2, gl.FLOAT, false, stride, 0);
                gl.vertexAttribDivisor(instancedLoc.a_offset, 1);
              }
              if (instancedLoc && instancedLoc.a_scale !== -1) {
                gl.enableVertexAttribArray(instancedLoc.a_scale);
                gl.vertexAttribPointer(instancedLoc.a_scale, 2, gl.FLOAT, false, stride, 8);
                gl.vertexAttribDivisor(instancedLoc.a_scale, 1);
              }
              if (instancedLoc && instancedLoc.a_rotation !== -1) {
                gl.enableVertexAttribArray(instancedLoc.a_rotation);
                gl.vertexAttribPointer(instancedLoc.a_rotation, 1, gl.FLOAT, false, stride, 16);
                gl.vertexAttribDivisor(instancedLoc.a_rotation, 1);
              }
              if (instancedLoc && instancedLoc.a_tint !== -1) {
                gl.enableVertexAttribArray(instancedLoc.a_tint);
                gl.vertexAttribPointer(instancedLoc.a_tint, 4, gl.FLOAT, false, stride, 20);
                gl.vertexAttribDivisor(instancedLoc.a_tint, 1);
              }
              if (instancedLoc && instancedLoc.a_shield !== -1) {
                gl.enableVertexAttribArray(instancedLoc.a_shield);
                gl.vertexAttribPointer(instancedLoc.a_shield, 1, gl.FLOAT, false, stride, 36);
                gl.vertexAttribDivisor(instancedLoc.a_shield, 1);
              }

              gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.quadIBO);
              gl.uniform2f(instancedLoc.u_resolution, gl.drawingBufferWidth, gl.drawingBufferHeight);
              gl.activeTexture(gl.TEXTURE0);
              gl.bindTexture(gl.TEXTURE_2D, atlasInfo.tex);
              gl.uniform1i(instancedLoc.u_tex, 0);
              gl.drawElementsInstanced(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0, totalQuads);
              continue;
            }

            const maxVerticesPerDraw = renderer._supportsUint32Indices ? Number.MAX_SAFE_INTEGER : 65535;
            const maxQuadsPerDraw = Math.max(1, Math.floor(maxVerticesPerDraw / 4));
            for (let start = 0; start < totalQuads; start += maxQuadsPerDraw) {
              const chunkQuads = Math.min(maxQuadsPerDraw, totalQuads - start);
              const vertCount = chunkQuads * 4;
              const idxCount = chunkQuads * 6;
              const vertFloatCount = vertCount * 4;
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
                renderer._tempIdxArr = new IndexArrayCtor(idxCount);
                renderer._tempIdxCapacity = idxCount;
              }
              const indices = renderer._tempIdxArr.subarray(0, idxCount);
              let vOff = 0;
              let iOff = 0;
              let baseVert = 0;
              for (let qi = 0; qi < chunkQuads; qi++) {
                const s = arr[start + qi];
                const scale = (s.radius * 2) / (atlasInfo.baseRadius * 2);
                const width = atlasInfo.size * scale * DPR;
                const height = atlasInfo.size * scale * DPR;
                const hx = width * 0.5;
                const hy = height * 0.5;
                const rot = s.angle || 0;
                const c = Math.cos(rot);
                const si = Math.sin(rot);
                const cx = s.x * DPR;
                const cy = s.y * DPR;
                const corners = [ [-hx, -hy], [hx, -hy], [hx, hy], [-hx, hy] ];
                const uvs = [ [0,1], [1,1], [1,0], [0,0] ];
                for (let k = 0; k < 4; k++) {
                  const lx = corners[k][0];
                  const ly = corners[k][1];
                  const rx = lx * c - ly * si;
                  const ry = lx * si + ly * c;
                  const px = cx + rx;
                  const py = cy + ry;
                  verts[vOff++] = px;
                  verts[vOff++] = py;
                  verts[vOff++] = uvs[k][0];
                  verts[vOff++] = uvs[k][1];
                }
                indices[iOff++] = baseVert + 0;
                indices[iOff++] = baseVert + 1;
                indices[iOff++] = baseVert + 2;
                indices[iOff++] = baseVert + 0;
                indices[iOff++] = baseVert + 2;
                indices[iOff++] = baseVert + 3;
                baseVert += 4;
              }

              gl.useProgram(programs.batched);
              gl.bindBuffer(gl.ARRAY_BUFFER, buffers.batchVBO);
              const vertsBytes = verts.byteLength;
              if (vertsBytes <= renderer._batchVBOCapacity) {
                gl.bufferSubData(gl.ARRAY_BUFFER, 0, verts);
              } else {
                let newCap = Math.max(vertsBytes, renderer._batchVBOCapacity * 2 || vertsBytes);
                gl.bufferData(gl.ARRAY_BUFFER, newCap, gl.DYNAMIC_DRAW);
                gl.bufferSubData(gl.ARRAY_BUFFER, 0, verts);
                renderer._batchVBOCapacity = newCap;
              }
              gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.batchIBO);
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
    },
    destroy() {
      gl = null;
    },
  };

  const texturedLoc = {
    a_pos: gl.getAttribLocation(programs.textured, 'a_pos'),
    a_uv: gl.getAttribLocation(programs.textured, 'a_uv'),
    u_resolution: gl.getUniformLocation(programs.textured, 'u_resolution'),
    u_pos: gl.getUniformLocation(programs.textured, 'u_pos'),
    u_scale: gl.getUniformLocation(programs.textured, 'u_scale'),
    u_rotation: gl.getUniformLocation(programs.textured, 'u_rotation'),
    u_tint: gl.getUniformLocation(programs.textured, 'u_tint'),
    u_tex: gl.getUniformLocation(programs.textured, 'u_tex')
  };

  const batchedLoc = {
    a_pos: gl.getAttribLocation(programs.batched, 'a_pos'),
    a_uv: gl.getAttribLocation(programs.batched, 'a_uv'),
    u_resolution: gl.getUniformLocation(programs.batched, 'u_resolution'),
    u_tint: gl.getUniformLocation(programs.batched, 'u_tint'),
    u_tex: gl.getUniformLocation(programs.batched, 'u_tex')
  };

  let instancedLoc = null;
  if (programs.instanced) {
    instancedLoc = {
      a_pos: gl.getAttribLocation(programs.instanced, 'a_pos'),
      a_uv: gl.getAttribLocation(programs.instanced, 'a_uv'),
      a_offset: gl.getAttribLocation(programs.instanced, 'a_offset'),
      a_scale: gl.getAttribLocation(programs.instanced, 'a_scale'),
      a_rotation: gl.getAttribLocation(programs.instanced, 'a_rotation'),
      a_tint: gl.getAttribLocation(programs.instanced, 'a_tint'),
      u_resolution: gl.getUniformLocation(programs.instanced, 'u_resolution'),
      u_tex: gl.getUniformLocation(programs.instanced, 'u_tex')
    };
  }

  const discLoc = {
    a_pos: gl.getAttribLocation(programs.disc, 'a_pos'),
    a_uv: gl.getAttribLocation(programs.disc, 'a_uv'),
    u_resolution: gl.getUniformLocation(programs.disc, 'u_resolution'),
    u_pos: gl.getUniformLocation(programs.disc, 'u_pos'),
    u_scale: gl.getUniformLocation(programs.disc, 'u_scale'),
    u_color: gl.getUniformLocation(programs.disc, 'u_color')
  };

  // detect whether 32-bit element indices are supported
  try { renderer._supportsUint32Indices = supportsUint32Indices(gl); } catch (e) { renderer._supportsUint32Indices = false; }

  // Prepare reusable temporary arrays to minimize per-frame allocations
  renderer._tmp = {
    verts: null,
    indices: null,
    inst: null
  };

  // If we have WebGL2 and an instanced program, query attribute/uniform locations
  if (programs.instanced && (typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext)) {
    // attribute locations
    renderer._instLoc = {
      a_pos: gl.getAttribLocation(programs.instanced, 'a_pos'),
      a_uv: gl.getAttribLocation(programs.instanced, 'a_uv'),
      a_off: gl.getAttribLocation(programs.instanced, 'a_off'),
      a_scale: gl.getAttribLocation(programs.instanced, 'a_scale'),
      a_rot: gl.getAttribLocation(programs.instanced, 'a_rot'),
      a_tint: gl.getAttribLocation(programs.instanced, 'a_tint'),
      a_shield: gl.getAttribLocation(programs.instanced, 'a_shield'),
      u_resolution: gl.getUniformLocation(programs.instanced, 'u_resolution'),
      u_tex: gl.getUniformLocation(programs.instanced, 'u_tex')
    };
  }

  // Reusable temporary arrays to reduce per-frame allocations
  renderer._tempVertArr = null; renderer._tempIdxArr = null;
  renderer._tempVertCapacity = 0; renderer._tempIdxCapacity = 0;
  renderer._instFloatArr = null; renderer._instCapacity = 0;
  // Current DPR used for the last render call (clamped)
  renderer._dpr = 1;

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