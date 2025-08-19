// Basic WebGL renderer scaffold.
// Draws ships as colored quads in clip-space. This is intentionally minimal:
// - Compiles a simple vertex/fragment shader
// - Uploads per-frame ship positions and colors to a dynamic buffer
// - Draws GL_POINTS (or instanced quads if available)
// If WebGL isn't available, the renderer acts as a no-op but doesn't throw.

function createShader(gl, type, source){ const s = gl.createShader(type); gl.shaderSource(s, source); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { const err = gl.getShaderInfoLog(s); gl.deleteShader(s); throw new Error('Shader compile error: '+err); } return s; }

function createProgram(gl, vsSrc, fsSrc){ const vs = createShader(gl, gl.VERTEX_SHADER, vsSrc); const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSrc); const p = gl.createProgram(); gl.attachShader(p, vs); gl.attachShader(p, fs); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { const err = gl.getProgramInfoLog(p); gl.deleteProgram(p); throw new Error('Program link error: '+err); } return p; }

export function createWebGLRenderer(canvas, opts = {}){
  const { webgl2 = false } = opts;
  let gl = null;
  let program = null;
  let quadBuffer = null; // static quad geometry
  let instancePosBuffer = null;
  let instanceColorBuffer = null;
  let tex = null;
  let extInstanced = null;
  let running = false;

  return {
    type: 'webgl',
    webgl2,
    init(){
      try {
        gl = canvas.getContext(webgl2 ? 'webgl2' : 'webgl');
        if (!gl) return;

        // Instanced quad shaders (WebGL1-compatible GLSL ES 1.00)
        const vs = `
          attribute vec2 a_quadPos; // -0.5..0.5 quad
          attribute vec2 a_instPos; // per-instance pixel position
          attribute vec3 a_instColor;
          uniform vec2 u_resolution;
          varying vec3 v_color;
          void main(){
            // convert instance pixel pos + quad offset into clip space
            vec2 pixelPos = a_instPos + a_quadPos;
            vec2 zeroToOne = pixelPos / u_resolution;
            vec2 clip = zeroToOne * 2.0 - 1.0;
            gl_Position = vec4(clip * vec2(1.0, -1.0), 0.0, 1.0);
            v_color = a_instColor;
          }
        `;

        const fs = `
          precision mediump float;
          varying vec3 v_color;
          void main(){
            gl_FragColor = vec4(v_color, 1.0);
          }
        `;

        program = createProgram(gl, vs, fs);

        // Quad geometry (two triangles forming a unit square centered at 0)
        quadBuffer = gl.createBuffer();
        const quadVerts = new Float32Array([
          -0.5, -0.5,
           0.5, -0.5,
          -0.5,  0.5,
           0.5,  0.5
        ]);
        gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer); gl.bufferData(gl.ARRAY_BUFFER, quadVerts, gl.STATIC_DRAW);

        instancePosBuffer = gl.createBuffer();
        instanceColorBuffer = gl.createBuffer();

        // try to enable instancing support on WebGL1 via ANGLE_instanced_arrays
        extInstanced = null;
        if (!webgl2) extInstanced = gl.getExtension('ANGLE_instanced_arrays');

        this.a_quadPos = gl.getAttribLocation(program, 'a_quadPos');
        this.a_instPos = gl.getAttribLocation(program, 'a_instPos');
        this.a_instColor = gl.getAttribLocation(program, 'a_instColor');
        this.u_resolution = gl.getUniformLocation(program, 'u_resolution');

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        // tiny white texture (atlas placeholder)
        tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
        const white = new Uint8Array([255,255,255,255]);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1,1,0, gl.RGBA, gl.UNSIGNED_BYTE, white);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      } catch (e) {
        // If any GL step fails, mark gl as null to indicate fallback
        gl = null; console.warn('WebGL init failed:', e.message || e);
      }
    },
    start(onReady){ running = true; if (typeof onReady === 'function') onReady(); },
    stop(){ running = false; },
    isRunning(){ return running; },
    render(state){
      if (!gl) return; // no-op if GL not available
      const { W, H, ships } = state;
      const n = ships.length;

      // build flat buffers for instance positions and colors
      const posData = new Float32Array(n * 2);
      const colorData = new Float32Array(n * 3);
      for (let i=0;i<n;i++){
        const s = ships[i]; posData[i*2+0] = s.x; posData[i*2+1] = s.y;
        colorData[i*3+0] = (s.team===0?1.0:0.31);
        colorData[i*3+1] = (s.team===0?0.35:0.63);
        colorData[i*3+2] = (s.team===0?0.35:1.0);
      }

      gl.viewport(0,0,canvas.width, canvas.height);
      gl.clearColor(0.02,0.02,0.03,1); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);
      gl.uniform2f(this.u_resolution, W, H);

      // quad attribute (per-vertex)
      gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
      gl.enableVertexAttribArray(this.a_quadPos);
      gl.vertexAttribPointer(this.a_quadPos, 2, gl.FLOAT, false, 0, 0);

      // instance positions
      gl.bindBuffer(gl.ARRAY_BUFFER, instancePosBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, posData, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(this.a_instPos);
      gl.vertexAttribPointer(this.a_instPos, 2, gl.FLOAT, false, 0, 0);
      // instance colors
      gl.bindBuffer(gl.ARRAY_BUFFER, instanceColorBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, colorData, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(this.a_instColor);
      gl.vertexAttribPointer(this.a_instColor, 3, gl.FLOAT, false, 0, 0);

      if (webgl2 || extInstanced) {
        if (webgl2) {
          gl.vertexAttribDivisor(this.a_instPos, 1);
          gl.vertexAttribDivisor(this.a_instColor, 1);
          gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, n);
          gl.vertexAttribDivisor(this.a_instPos, 0);
          gl.vertexAttribDivisor(this.a_instColor, 0);
        } else {
          extInstanced.vertexAttribDivisorANGLE(this.a_instPos, 1);
          extInstanced.vertexAttribDivisorANGLE(this.a_instColor, 1);
          extInstanced.drawArraysInstancedANGLE(gl.TRIANGLE_STRIP, 0, 4, n);
          extInstanced.vertexAttribDivisorANGLE(this.a_instPos, 0);
          extInstanced.vertexAttribDivisorANGLE(this.a_instColor, 0);
        }
      } else {
        // fallback: draw instances in a loop
        for (let i=0;i<n;i++){
          // set per-instance attributes via buffers
          gl.bufferData(gl.ARRAY_BUFFER, posData.subarray(i*2, i*2+2), gl.DYNAMIC_DRAW);
          gl.vertexAttribPointer(this.a_instPos, 2, gl.FLOAT, false, 0, 0);
          gl.bufferData(gl.ARRAY_BUFFER, colorData.subarray(i*3, i*3+3), gl.DYNAMIC_DRAW);
          gl.vertexAttribPointer(this.a_instColor, 3, gl.FLOAT, false, 0, 0);
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        }
      }
    },
    destroy(){ if (gl){ try { gl.deleteBuffer(posBuffer); gl.deleteBuffer(colorBuffer); gl.deleteProgram(program); } catch(e){} gl = null; } running = false; }
  };
}

export default { createWebGLRenderer };
