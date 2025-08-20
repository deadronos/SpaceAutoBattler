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
  let instanceSizeBuffer = null; // per-instance size (radius)
  let instanceAngleBuffer = null; // per-instance rotation (radians)
  let instanceShieldBuffer = null; // per-instance shield fraction 0..1
  let tex = null;
  let extInstanced = null;
  let running = false;
  let pixelRatio = 1;
  let handleResize = null;

  return {
    type: 'webgl',
    webgl2,
    init(){
      try {
  gl = canvas.getContext(webgl2 ? 'webgl2' : 'webgl');
        if (!gl) return;

  // Respect device pixel ratio for crisp rendering
  pixelRatio = typeof window !== 'undefined' && window.devicePixelRatio ? window.devicePixelRatio : 1;
  canvas.width = Math.max(1, Math.floor((canvas.clientWidth || canvas.width) * pixelRatio));
  canvas.height = Math.max(1, Math.floor((canvas.clientHeight || canvas.height) * pixelRatio));

        // Instanced quad shaders (WebGL1-compatible GLSL ES 1.00)
        const vs = `
          attribute vec2 a_quadPos; // -0.5..0.5 unit quad
          attribute vec2 a_instPos; // per-instance pixel center
          attribute vec3 a_instColor;
          attribute float a_instSize; // ship radius in pixels
          attribute float a_instAngle; // ship orientation (radians)
          attribute float a_instShield; // shield fraction 0..1
          uniform vec2 u_resolution;
          varying vec3 v_color;
          varying vec2 v_local; // local space after scale & rotation (diameter scale)
          varying float v_shield;
          varying float v_radius;
          void main(){
            float c = cos(a_instAngle);
            float s = sin(a_instAngle);
            vec2 rotated = vec2(
              a_quadPos.x * c - a_quadPos.y * s,
              a_quadPos.x * s + a_quadPos.y * c
            );
            vec2 pixelPos = a_instPos + rotated * a_instSize * 2.0; // diameter scaling
            vec2 zeroToOne = pixelPos / u_resolution;
            vec2 clip = zeroToOne * 2.0 - 1.0;
            gl_Position = vec4(clip * vec2(1.0, -1.0), 0.0, 1.0);
            v_color = a_instColor;
            v_local = rotated * a_instSize * 2.0; // used for circle SDF
            v_shield = a_instShield;
            v_radius = a_instSize;
          }
        `;

        const fs = `
          precision mediump float;
          varying vec3 v_color;
          varying vec2 v_local;
          varying float v_shield;
          varying float v_radius; // true circle radius in pixels
          void main(){
            float d = length(v_local); // distance from center
            float edge = fwidth(d) * 1.5; // widen edge slightly for smoother look
            float alpha = 1.0 - smoothstep(v_radius - edge, v_radius + edge, d);
            if (alpha <= 0.001) discard;
            vec3 base = v_color;
            // Optional shield ring: show thin ring if shield fraction > 0
            if (v_shield > 0.0) {
              float ringOuter = v_radius * 1.05; // just outside body
              float ringInner = v_radius * 0.90; // inside overlap
              float ringEdge = fwidth(d)*1.5;
              float ringMask = smoothstep(ringInner - ringEdge, ringInner + ringEdge, d) * (1.0 - smoothstep(ringOuter - ringEdge, ringOuter + ringEdge, d));
              // ring color blend (cyan-like) scaled by shield fraction
              vec3 ringColor = mix(base, vec3(0.3,0.9,1.0), 0.6 * v_shield);
              base = mix(base, ringColor, clamp(ringMask,0.0,1.0));
            }
            gl_FragColor = vec4(base, alpha);
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
  instanceSizeBuffer = gl.createBuffer();
  instanceAngleBuffer = gl.createBuffer();
  instanceShieldBuffer = gl.createBuffer();

  // try to enable instancing support on WebGL1 via ANGLE_instanced_arrays
  extInstanced = null;
  if (!webgl2) extInstanced = gl.getExtension('ANGLE_instanced_arrays');

  // Cache attribute/uniform locations; some engines may optimize away unused attribs
  this.a_quadPos = gl.getAttribLocation(program, 'a_quadPos');
  this.a_instPos = gl.getAttribLocation(program, 'a_instPos');
  this.a_instColor = gl.getAttribLocation(program, 'a_instColor');
  this.a_instSize = gl.getAttribLocation(program, 'a_instSize');
  this.a_instAngle = gl.getAttribLocation(program, 'a_instAngle');
  this.a_instShield = gl.getAttribLocation(program, 'a_instShield');
  this.u_resolution = gl.getUniformLocation(program, 'u_resolution');

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        // tiny white texture (atlas placeholder)
        tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
        const white = new Uint8Array([255,255,255,255]);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1,1,0, gl.RGBA, gl.UNSIGNED_BYTE, white);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

        // Setup runtime resize listener (DPR aware)
        if (typeof window !== 'undefined') {
          handleResize = () => {
            const dpr = window.devicePixelRatio || 1;
            if (dpr !== pixelRatio) pixelRatio = dpr;
            const cssW = canvas.clientWidth || canvas.width / pixelRatio;
            const cssH = canvas.clientHeight || canvas.height / pixelRatio;
            const newW = Math.max(1, Math.floor(cssW * pixelRatio));
            const newH = Math.max(1, Math.floor(cssH * pixelRatio));
            if (newW !== canvas.width || newH !== canvas.height) {
              canvas.width = newW; canvas.height = newH;
              if (gl) gl.viewport(0,0,newW,newH);
            }
          };
          window.addEventListener('resize', handleResize);
        }
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
      const { W, H, ships, bullets = [], stars = [] } = state;
      // Combine ships + bullets + stars into one instanced batch so the scene isn't blank when only stars present.
      const shipCount = ships.length;
      const bulletCount = bullets.length;
      const starCount = stars.length;
      const n = shipCount + bulletCount + starCount;
      if (n === 0) return; // nothing to draw

      const posData = new Float32Array(n * 2);
      const colorData = new Float32Array(n * 3);
      const sizeData = new Float32Array(n);
      const angleData = new Float32Array(n);
      const shieldData = new Float32Array(n);
      let idx = 0;
      // ships
      for (let i=0;i<shipCount;i++, idx++){
        const s = ships[i]; posData[idx*2] = s.x; posData[idx*2+1] = s.y;
        colorData[idx*3] = (s.team===0?1.0:0.31);
        colorData[idx*3+1] = (s.team===0?0.35:0.63);
        colorData[idx*3+2] = (s.team===0?0.35:1.0);
        sizeData[idx] = s.radius || 8;
        angleData[idx] = (s.vx || s.vy) ? Math.atan2(s.vy, s.vx) : s.angle || 0;
        let shFrac = 0;
        if (typeof s.shield === 'number' && typeof s.shieldMax === 'number' && s.shieldMax > 0) shFrac = Math.min(1, Math.max(0, s.shield / s.shieldMax));
        shieldData[idx] = shFrac;
      }
      // bullets (small bright circles, no shield, orientation from velocity)
      for (let i=0;i<bulletCount;i++, idx++){
        const b = bullets[i]; posData[idx*2] = b.x; posData[idx*2+1] = b.y;
        colorData[idx*3] = (b.team===0?1.0:0.35);
        colorData[idx*3+1] = (b.team===0?0.35:0.63);
        colorData[idx*3+2] = (b.team===0?0.35:1.0);
        sizeData[idx] = b.radius || 2.2;
        angleData[idx] = (b.vx || b.vy) ? Math.atan2(b.vy, b.vx) : 0;
        shieldData[idx] = 0;
      }
      // stars (tiny white points, flicker by phase if provided)
      for (let i=0;i<starCount;i++, idx++){
        const st = stars[i]; posData[idx*2] = st.x; posData[idx*2+1] = st.y;
        const tw = (st.phase != null) ? (0.6 + 0.4 * Math.sin(st.phase)) : 1.0;
        const base = 0.85 + 0.15 * tw;
        colorData[idx*3] = base; colorData[idx*3+1] = base; colorData[idx*3+2] = 1.0;
        sizeData[idx] = (st.r || 1) + 0.5 * tw;
        angleData[idx] = 0;
        shieldData[idx] = 0;
      }

      gl.viewport(0,0,canvas.width, canvas.height);
      gl.clearColor(0.02,0.02,0.03,1); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);
      gl.uniform2f(this.u_resolution, W, H);

      // quad attribute (per-vertex)
      gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
        if (this.a_quadPos >= 0) {
          gl.enableVertexAttribArray(this.a_quadPos);
          gl.vertexAttribPointer(this.a_quadPos, 2, gl.FLOAT, false, 0, 0);
        }

      // instance positions
      if (this.a_instPos >= 0) {
        gl.bindBuffer(gl.ARRAY_BUFFER, instancePosBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, posData, gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(this.a_instPos);
        gl.vertexAttribPointer(this.a_instPos, 2, gl.FLOAT, false, 0, 0);
      }
      // instance colors
      if (this.a_instColor >= 0) {
        gl.bindBuffer(gl.ARRAY_BUFFER, instanceColorBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, colorData, gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(this.a_instColor);
        gl.vertexAttribPointer(this.a_instColor, 3, gl.FLOAT, false, 0, 0);
      }
      // instance sizes (float)
      if (this.a_instSize >= 0) {
        gl.bindBuffer(gl.ARRAY_BUFFER, instanceSizeBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, sizeData, gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(this.a_instSize);
        gl.vertexAttribPointer(this.a_instSize, 1, gl.FLOAT, false, 0, 0);
      }
      if (this.a_instAngle >= 0) {
        gl.bindBuffer(gl.ARRAY_BUFFER, instanceAngleBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, angleData, gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(this.a_instAngle);
        gl.vertexAttribPointer(this.a_instAngle, 1, gl.FLOAT, false, 0, 0);
      }
      if (this.a_instShield >= 0) {
        gl.bindBuffer(gl.ARRAY_BUFFER, instanceShieldBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, shieldData, gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(this.a_instShield);
        gl.vertexAttribPointer(this.a_instShield, 1, gl.FLOAT, false, 0, 0);
      }

      if (webgl2 || extInstanced) {
        if (webgl2) {
          if (this.a_instPos >= 0) gl.vertexAttribDivisor(this.a_instPos, 1);
          if (this.a_instColor >= 0) gl.vertexAttribDivisor(this.a_instColor, 1);
          if (this.a_instSize >= 0) gl.vertexAttribDivisor(this.a_instSize, 1);
          if (this.a_instAngle >= 0) gl.vertexAttribDivisor(this.a_instAngle, 1);
          if (this.a_instShield >= 0) gl.vertexAttribDivisor(this.a_instShield, 1);
          gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, n);
          if (this.a_instPos >= 0) gl.vertexAttribDivisor(this.a_instPos, 0);
          if (this.a_instColor >= 0) gl.vertexAttribDivisor(this.a_instColor, 0);
          if (this.a_instSize >= 0) gl.vertexAttribDivisor(this.a_instSize, 0);
          if (this.a_instAngle >= 0) gl.vertexAttribDivisor(this.a_instAngle, 0);
          if (this.a_instShield >= 0) gl.vertexAttribDivisor(this.a_instShield, 0);
        } else {
          if (extInstanced) {
            if (this.a_instPos >= 0) extInstanced.vertexAttribDivisorANGLE(this.a_instPos, 1);
            if (this.a_instColor >= 0) extInstanced.vertexAttribDivisorANGLE(this.a_instColor, 1);
            if (this.a_instSize >= 0) extInstanced.vertexAttribDivisorANGLE(this.a_instSize, 1);
            if (this.a_instAngle >= 0) extInstanced.vertexAttribDivisorANGLE(this.a_instAngle, 1);
            if (this.a_instShield >= 0) extInstanced.vertexAttribDivisorANGLE(this.a_instShield, 1);
            extInstanced.drawArraysInstancedANGLE(gl.TRIANGLE_STRIP, 0, 4, n);
            if (this.a_instPos >= 0) extInstanced.vertexAttribDivisorANGLE(this.a_instPos, 0);
            if (this.a_instColor >= 0) extInstanced.vertexAttribDivisorANGLE(this.a_instColor, 0);
            if (this.a_instSize >= 0) extInstanced.vertexAttribDivisorANGLE(this.a_instSize, 0);
            if (this.a_instAngle >= 0) extInstanced.vertexAttribDivisorANGLE(this.a_instAngle, 0);
            if (this.a_instShield >= 0) extInstanced.vertexAttribDivisorANGLE(this.a_instShield, 0);
          } else {
            // fallback: draw instances in a loop using vertexAttrib* when indices are available
            for (let i=0;i<n;i++){
              const px = posData[i*2+0], py = posData[i*2+1];
              const cr = colorData[i*3+0], cg = colorData[i*3+1], cb = colorData[i*3+2];
              const sz = sizeData[i];
              const ang = angleData[i];
              const sh = shieldData[i];
              if (this.a_instPos >= 0) gl.vertexAttrib2f(this.a_instPos, px, py);
              if (this.a_instColor >= 0) gl.vertexAttrib3f(this.a_instColor, cr, cg, cb);
              if (this.a_instSize >= 0) gl.vertexAttrib1f(this.a_instSize, sz);
              if (this.a_instAngle >= 0) gl.vertexAttrib1f(this.a_instAngle, ang);
              if (this.a_instShield >= 0) gl.vertexAttrib1f(this.a_instShield, sh);
              gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
            }
          }
        }
      } else {
        // fallback: draw instances in a loop
        for (let i=0;i<n;i++){
          const px = posData[i*2+0], py = posData[i*2+1];
          const cr = colorData[i*3+0], cg = colorData[i*3+1], cb = colorData[i*3+2];
          const sz = sizeData[i];
          const ang = angleData[i];
          const sh = shieldData[i];
          if (this.a_instPos >= 0) gl.vertexAttrib2f(this.a_instPos, px, py);
          if (this.a_instColor >= 0) gl.vertexAttrib3f(this.a_instColor, cr, cg, cb);
          if (this.a_instSize >= 0) gl.vertexAttrib1f(this.a_instSize, sz);
          if (this.a_instAngle >= 0) gl.vertexAttrib1f(this.a_instAngle, ang);
          if (this.a_instShield >= 0) gl.vertexAttrib1f(this.a_instShield, sh);
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        }
      }
    },
    destroy(){ if (gl){ try { if (quadBuffer) gl.deleteBuffer(quadBuffer); if (instancePosBuffer) gl.deleteBuffer(instancePosBuffer); if (instanceColorBuffer) gl.deleteBuffer(instanceColorBuffer); if (instanceSizeBuffer) gl.deleteBuffer(instanceSizeBuffer); if (instanceAngleBuffer) gl.deleteBuffer(instanceAngleBuffer); if (instanceShieldBuffer) gl.deleteBuffer(instanceShieldBuffer); if (program) gl.deleteProgram(program); if (tex) gl.deleteTexture(tex); } catch(e){} gl = null; }
      if (typeof window !== 'undefined' && handleResize) { window.removeEventListener('resize', handleResize); }
      running = false; }
  };
}

export default { createWebGLRenderer };
