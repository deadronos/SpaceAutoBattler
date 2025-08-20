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
  // atlasAccessor(type, radius) -> { canvas, size, baseRadius }
  const atlasAccessor = opts.atlasAccessor || null;
  const atlasLODs = opts.atlasLODs || [12,20,36];
  let gl = null;
  let program = null;
  let quadBuffer = null; // static quad geometry
  // Ship-specific instance buffers
  let shipPosBuffer = null;
  let shipColorBuffer = null;
  let shipSizeBuffer = null; // per-ship size (radius)
  let shipAngleBuffer = null; // per-ship rotation (radians)
  let shipShieldBuffer = null; // per-ship shield fraction 0..1
  // Non-ship (bullets+stars) instance buffers
  let nonShipPosBuffer = null;
  let nonShipColorBuffer = null;
  let nonShipSizeBuffer = null;
  let nonShipAngleBuffer = null;
  let nonShipShieldBuffer = null;
  let nonShipTypeBuffer = null; // type id for non-ship primitives (0=circle)
  let tex = null;
  let extInstanced = null;
  let running = false;
  let pixelRatio = 1;
  let handleResize = null;

  // Helper: build per-instance Float32Array buffers for a list of ships
  function buildShipArrays(list) {
    const count = list.length;
    const pos = new Float32Array(count * 2);
    const color = new Float32Array(count * 3);
    const size = new Float32Array(count);
    const angle = new Float32Array(count);
    const shield = new Float32Array(count);
    const type = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const s = list[i];
      pos[i * 2] = s.x; pos[i * 2 + 1] = s.y;
      color[i * 3] = (s.team === 0 ? 1.0 : 0.31);
      color[i * 3 + 1] = (s.team === 0 ? 0.35 : 0.63);
      color[i * 3 + 2] = (s.team === 0 ? 0.35 : 1.0);
      size[i] = s.radius || 8;
      angle[i] = (s.vx || s.vy) ? Math.atan2(s.vy, s.vx) : s.angle || 0;
      let sh = 0;
      if (typeof s.shield === 'number' && typeof s.shieldMax === 'number' && s.shieldMax > 0) sh = Math.min(1, Math.max(0, s.shield / s.shieldMax));
      shield[i] = sh;
      let tId = 1;
      if (s.type === 'corvette') tId = 1; else if (s.type === 'frigate') tId = 2; else if (s.type === 'destroyer') tId = 3; else if (s.type === 'carrier') tId = 4; else if (s.type === 'fighter') tId = 5;
      type[i] = tId;
    }
    return { count, pos, color, size, angle, shield, type };
  }

  // Helper: group ships by atlas key (type + baseRadius + size)
  function groupShipsByAtlas(shipsList) {
    const groups = Object.create(null);
    for (let i = 0; i < shipsList.length; i++) {
      const s = shipsList[i];
      const atlas = atlasAccessor ? atlasAccessor(s.type, s.radius || 8) : null;
      if (!atlas) continue;
      const key = s.type + '|' + String(atlas.baseRadius) + '|' + String(atlas.size || (atlas.canvas && atlas.canvas.width));
      let g = groups[key]; if (!g) { g = groups[key] = { atlas, ships: [] }; }
      g.ships.push(s);
    }
    return groups;
  }

  const renderer = { 
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
  // For maximum compatibility avoid relying on standard derivatives (fwidth).
  // Use a small pixel-based edge width computed from the reported radius so
  // shaders compile across WebGL1 and WebGL2 targets. Keep the edge narrow
  // for crisper circles.
  const edgeExpr = 'clamp(max(0.5, v_radius * 0.01), 0.5, 3.0)';

  const vs = `
          attribute vec2 a_quadPos; // -0.5..0.5 unit quad
          attribute vec2 a_instPos; // per-instance pixel center
          attribute vec3 a_instColor;
          attribute float a_instSize; // ship radius in pixels
          attribute float a_instAngle; // ship orientation (radians)
          attribute float a_instShield; // shield fraction 0..1
          attribute float a_instType; // shape type id
          uniform vec2 u_resolution;
          varying vec3 v_color;
          varying vec2 v_local; // local space after scale & rotation (diameter scale)
          varying float v_shield;
          varying float v_radius;
          varying float v_type;
          varying float v_angle;
          void main(){
            float c = cos(a_instAngle);
            float s = sin(a_instAngle);
            vec2 rotated = vec2(
              a_quadPos.x * c - a_quadPos.y * s,
              a_quadPos.x * s + a_quadPos.y * c
            );
              vec2 pixelPos = a_instPos + rotated * a_instSize * 2.0; // diameter scaling (vertex position)
            vec2 zeroToOne = pixelPos / u_resolution;
            vec2 clip = zeroToOne * 2.0 - 1.0;
            gl_Position = vec4(clip * vec2(1.0, -1.0), 0.0, 1.0);
            v_color = a_instColor;
              // v_local should be in pixels from center to match v_radius (radius in pixels).
              // Use scale = a_instSize (radius) so length(v_local) ranges ~0..v_radius.
              v_local = rotated * a_instSize; // used for circle SDF (pixels)
            v_shield = a_instShield;
            v_radius = a_instSize;
            v_type = a_instType;
            v_angle = a_instAngle;
          }
        `;

    const fs = `precision mediump float;
          varying vec3 v_color;
          varying vec2 v_local;
          varying float v_shield;
          varying float v_radius; // true circle radius in pixels
          varying float v_type;
          varying float v_angle;
          void main(){
            float d = length(v_local); // distance from center
            float edge = ${edgeExpr}; // widen edge slightly for smoother look
            // Shape modulation: vary effective radius by angle to approximate different hull silhouettes.
            float theta = atan(v_local.y, v_local.x) - v_angle;
            float modFactor = 1.0;
            // type mapping: 0 circle, 1 corvette (arrow), 2 frigate (sleek), 3 destroyer (broad), 4 carrier (ellipse), 5 fighter (small triangle)
            if (v_type < 0.5) {
              modFactor = 1.0; // circle
            } else if (v_type < 1.5) {
              // corvette: pointed front — use 3-lobed variation
              modFactor = 1.0 + 0.45 * cos(3.0 * theta);
            } else if (v_type < 2.5) {
              // frigate: smoother elongation
              modFactor = 1.0 + 0.20 * cos(2.0 * theta);
            } else if (v_type < 3.5) {
              // destroyer: wider body with subtle faceting
              modFactor = 1.0 + 0.28 * cos(4.0 * theta);
            } else if (v_type < 4.5) {
              // carrier: near-ellipse (scale x by 1.6)
              // emulate by shrinking radius along lateral axis
              float ex = cos(theta);
              float ey = sin(theta);
              float scale = 1.0 + 0.6 * ex * ex; // wider on x
              modFactor = scale;
            } else {
              // fighter: small pointed triangle-ish
              modFactor = 1.0 + 0.6 * cos(3.0 * theta);
            }
            float effRadius = v_radius * modFactor;
            float alpha = 1.0 - smoothstep(effRadius - edge, effRadius + edge, d);
            if (alpha <= 0.001) discard;
            vec3 base = v_color;
            // Optional shield ring: show thin ring if shield fraction > 0
            if (v_shield > 0.0) {
              float ringOuter = v_radius * 1.05; // just outside body
              float ringInner = v_radius * 0.90; // inside overlap
              float ringEdge = ${edgeExpr};
              float ringMask = smoothstep(ringInner - ringEdge, ringInner + ringEdge, d) * (1.0 - smoothstep(ringOuter - ringEdge, ringOuter + ringEdge, d));
              // ring color blend (cyan-like) scaled by shield fraction
              vec3 ringColor = mix(base, vec3(0.3,0.9,1.0), 0.6 * v_shield);
              base = mix(base, ringColor, clamp(ringMask,0.0,1.0));
            }
            gl_FragColor = vec4(base, alpha);
          }
        `;

        program = createProgram(gl, vs, fs);

        // Textured program: samples an atlas and tints by v_color
        const vsTex = `
          attribute vec2 a_quadPos;
          attribute vec2 a_instPos;
          attribute vec3 a_instColor;
          attribute float a_instSize;
          attribute float a_instAngle;
          attribute float a_instShield;
          uniform vec2 u_resolution;
          varying vec2 v_uv;
          varying vec3 v_color;
          varying float v_shield;
          void main(){
            float c = cos(a_instAngle);
            float s = sin(a_instAngle);
            vec2 rotated = vec2(
              a_quadPos.x * c - a_quadPos.y * s,
              a_quadPos.x * s + a_quadPos.y * c
            );
            vec2 pixelPos = a_instPos + rotated * a_instSize * 2.0;
            vec2 zeroToOne = pixelPos / u_resolution;
            vec2 clip = zeroToOne * 2.0 - 1.0;
            gl_Position = vec4(clip * vec2(1.0, -1.0), 0.0, 1.0);
            v_uv = a_quadPos + vec2(0.5, 0.5);
            v_color = a_instColor;
            v_shield = a_instShield;
          }
        `;

        const fsTex = `precision mediump float;
          varying vec2 v_uv;
          varying vec3 v_color;
          varying float v_shield;
          uniform sampler2D u_atlas;
          void main(){
            vec4 tex = texture2D(u_atlas, v_uv);
            float alpha = tex.a * tex.r; // atlas is white/alpha mask; use r as mask fallback
            if (alpha <= 0.001) discard;
            vec3 col = v_color * tex.rgb;
            // subtle shield tint
            if (v_shield > 0.0) col = mix(col, vec3(0.3,0.9,1.0), 0.25 * v_shield);
            gl_FragColor = vec4(col, alpha);
          }
        `;
        let texturedProgram = null;
        try { texturedProgram = createProgram(gl, vsTex, fsTex); } catch(e) { texturedProgram = null; }


        // Quad geometry (two triangles forming a unit square centered at 0)
        quadBuffer = gl.createBuffer();
        const quadVerts = new Float32Array([
          -0.5, -0.5,
           0.5, -0.5,
          -0.5,  0.5,
           0.5,  0.5
        ]);
        gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer); gl.bufferData(gl.ARRAY_BUFFER, quadVerts, gl.STATIC_DRAW);

  // ship buffers
  shipPosBuffer = gl.createBuffer();
  shipColorBuffer = gl.createBuffer();
  shipSizeBuffer = gl.createBuffer();
  shipAngleBuffer = gl.createBuffer();
  shipShieldBuffer = gl.createBuffer();
  // non-ship buffers (bullets + stars)
  nonShipPosBuffer = gl.createBuffer();
  nonShipColorBuffer = gl.createBuffer();
  nonShipSizeBuffer = gl.createBuffer();
  nonShipAngleBuffer = gl.createBuffer();
  nonShipShieldBuffer = gl.createBuffer();
  nonShipTypeBuffer = gl.createBuffer();

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
  this.a_instType = gl.getAttribLocation(program, 'a_instType');
  this.u_resolution = gl.getUniformLocation(program, 'u_resolution');

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        // tiny white texture (atlas placeholder)
        tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
        const white = new Uint8Array([255,255,255,255]);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1,1,0, gl.RGBA, gl.UNSIGNED_BYTE, white);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

        // Atlas texture cache: { [type]: { [baseRadius]: { tex, atlas } } }
        this._atlasTextures = {};
        this._ensureAtlasTexture = (type, baseRadius, atlas) => {
          try {
            this._atlasTextures[type] = this._atlasTextures[type] || {};
            const key = String(baseRadius);
            if (this._atlasTextures[type][key]) return this._atlasTextures[type][key];
            const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
            gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas.canvas);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            this._atlasTextures[type][key] = { tex: t, atlas };
            return this._atlasTextures[type][key];
          } catch(e){ console.warn('Failed to create atlas texture', e); return null; }
        };

        // store texturedProgram and its locations for use in render
        this._texturedProgram = texturedProgram;
        if (texturedProgram) {
          this._t_a_quadPos = gl.getAttribLocation(texturedProgram, 'a_quadPos');
          this._t_a_instPos = gl.getAttribLocation(texturedProgram, 'a_instPos');
          this._t_a_instColor = gl.getAttribLocation(texturedProgram, 'a_instColor');
          this._t_a_instSize = gl.getAttribLocation(texturedProgram, 'a_instSize');
          this._t_a_instAngle = gl.getAttribLocation(texturedProgram, 'a_instAngle');
          this._t_a_instShield = gl.getAttribLocation(texturedProgram, 'a_instShield');
          this._t_u_resolution = gl.getUniformLocation(texturedProgram, 'u_resolution');
          this._t_u_atlas = gl.getUniformLocation(texturedProgram, 'u_atlas');
        }

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

      // Setup viewport, clear and bind SDF program before any draw calls
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

      // Ships: draw either via textured groups (if atlas available) OR via SDF program using ship buffers
      // Build ship arrays and upload to ship buffers when SDF program is used (textured path uploads its own per-group buffers)
      if (!(atlasAccessor && this._texturedProgram)) {
        // No textured atlas usage; build arrays for all ships and draw with SDF program
        const sCount = shipCount;
        if (sCount > 0) {
          const { pos: sPos, color: sColor, size: sSize, angle: sAngle, shield: sShield, type: sType } = buildShipArrays(ships);
          // upload ship buffers
          gl.bindBuffer(gl.ARRAY_BUFFER, shipPosBuffer); gl.bufferData(gl.ARRAY_BUFFER, sPos, gl.DYNAMIC_DRAW);
          if (this.a_instPos >= 0) { gl.enableVertexAttribArray(this.a_instPos); gl.vertexAttribPointer(this.a_instPos, 2, gl.FLOAT, false, 0, 0); }
          gl.bindBuffer(gl.ARRAY_BUFFER, shipColorBuffer); gl.bufferData(gl.ARRAY_BUFFER, sColor, gl.DYNAMIC_DRAW);
          if (this.a_instColor >= 0) { gl.enableVertexAttribArray(this.a_instColor); gl.vertexAttribPointer(this.a_instColor, 3, gl.FLOAT, false, 0, 0); }
          gl.bindBuffer(gl.ARRAY_BUFFER, shipSizeBuffer); gl.bufferData(gl.ARRAY_BUFFER, sSize, gl.DYNAMIC_DRAW);
          if (this.a_instSize >= 0) { gl.enableVertexAttribArray(this.a_instSize); gl.vertexAttribPointer(this.a_instSize, 1, gl.FLOAT, false, 0, 0); }
          gl.bindBuffer(gl.ARRAY_BUFFER, shipAngleBuffer); gl.bufferData(gl.ARRAY_BUFFER, sAngle, gl.DYNAMIC_DRAW);
          if (this.a_instAngle >= 0) { gl.enableVertexAttribArray(this.a_instAngle); gl.vertexAttribPointer(this.a_instAngle, 1, gl.FLOAT, false, 0, 0); }
          gl.bindBuffer(gl.ARRAY_BUFFER, shipShieldBuffer); gl.bufferData(gl.ARRAY_BUFFER, sShield, gl.DYNAMIC_DRAW);
          if (this.a_instShield >= 0) { gl.enableVertexAttribArray(this.a_instShield); gl.vertexAttribPointer(this.a_instShield, 1, gl.FLOAT, false, 0, 0); }
          if (this.a_instType >= 0) {
            // reuse nonShipTypeBuffer to store ship types if needed
            gl.bindBuffer(gl.ARRAY_BUFFER, nonShipTypeBuffer); gl.bufferData(gl.ARRAY_BUFFER, sType, gl.DYNAMIC_DRAW);
            gl.enableVertexAttribArray(this.a_instType); gl.vertexAttribPointer(this.a_instType, 1, gl.FLOAT, false, 0, 0);
          }

          // draw ships via instancing
          if (webgl2) {
            if (this.a_instPos >= 0) gl.vertexAttribDivisor(this.a_instPos, 1);
            if (this.a_instColor >= 0) gl.vertexAttribDivisor(this.a_instColor, 1);
            if (this.a_instSize >= 0) gl.vertexAttribDivisor(this.a_instSize, 1);
            if (this.a_instAngle >= 0) gl.vertexAttribDivisor(this.a_instAngle, 1);
            if (this.a_instShield >= 0) gl.vertexAttribDivisor(this.a_instShield, 1);
            if (this.a_instType >= 0) gl.vertexAttribDivisor(this.a_instType, 1);
            gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, sCount);
            if (this.a_instPos >= 0) gl.vertexAttribDivisor(this.a_instPos, 0);
            if (this.a_instColor >= 0) gl.vertexAttribDivisor(this.a_instColor, 0);
            if (this.a_instSize >= 0) gl.vertexAttribDivisor(this.a_instSize, 0);
            if (this.a_instAngle >= 0) gl.vertexAttribDivisor(this.a_instAngle, 0);
            if (this.a_instShield >= 0) gl.vertexAttribDivisor(this.a_instShield, 0);
            if (this.a_instType >= 0) gl.vertexAttribDivisor(this.a_instType, 0);
          } else if (extInstanced) {
            if (this.a_instPos >= 0) extInstanced.vertexAttribDivisorANGLE(this.a_instPos, 1);
            if (this.a_instColor >= 0) extInstanced.vertexAttribDivisorANGLE(this.a_instColor, 1);
            if (this.a_instSize >= 0) extInstanced.vertexAttribDivisorANGLE(this.a_instSize, 1);
            if (this.a_instAngle >= 0) extInstanced.vertexAttribDivisorANGLE(this.a_instAngle, 1);
            if (this.a_instShield >= 0) extInstanced.vertexAttribDivisorANGLE(this.a_instShield, 1);
            if (this.a_instType >= 0) extInstanced.vertexAttribDivisorANGLE(this.a_instType, 1);
            extInstanced.drawArraysInstancedANGLE(gl.TRIANGLE_STRIP, 0, 4, sCount);
            if (this.a_instPos >= 0) extInstanced.vertexAttribDivisorANGLE(this.a_instPos, 0);
            if (this.a_instColor >= 0) extInstanced.vertexAttribDivisorANGLE(this.a_instColor, 0);
            if (this.a_instSize >= 0) extInstanced.vertexAttribDivisorANGLE(this.a_instSize, 0);
            if (this.a_instAngle >= 0) extInstanced.vertexAttribDivisorANGLE(this.a_instAngle, 0);
            if (this.a_instShield >= 0) extInstanced.vertexAttribDivisorANGLE(this.a_instShield, 0);
            if (this.a_instType >= 0) extInstanced.vertexAttribDivisorANGLE(this.a_instType, 0);
          } else {
            for (let i=0;i<sCount;i++){
              const px = sPos[i*2+0], py = sPos[i*2+1];
              const cr = sColor[i*3+0], cg = sColor[i*3+1], cb = sColor[i*3+2];
              const sz = sSize[i]; const ang = sAngle[i]; const sh = sShield[i];
              if (this.a_instPos >= 0) gl.vertexAttrib2f(this.a_instPos, px, py);
              if (this.a_instColor >= 0) gl.vertexAttrib3f(this.a_instColor, cr, cg, cb);
              if (this.a_instSize >= 0) gl.vertexAttrib1f(this.a_instSize, sz);
              if (this.a_instAngle >= 0) gl.vertexAttrib1f(this.a_instAngle, ang);
              if (this.a_instShield >= 0) gl.vertexAttrib1f(this.a_instShield, sh);
              if (this.a_instType >= 0) gl.vertexAttrib1f(this.a_instType, sType[i]);
              gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
            }
          }
        }
      } else {
        // Textured path: group ships by atlas (type+baseRadius) and draw each group
  const groups = groupShipsByAtlas(ships);

        // If grouping doesn't cover all ships, fall back to SDF path for this frame
        let groupedTotal = 0; for (const k in groups) groupedTotal += groups[k].ships.length;
        if (groupedTotal !== shipCount) {
          // Fallback: draw all ships via SDF program (same as non-textured path)
          const sCount2 = shipCount;
          if (sCount2 > 0) {
            const { pos: sPos2, color: sColor2, size: sSize2, angle: sAngle2, shield: sShield2, type: sType2 } = buildShipArrays(ships);
            // upload ship buffers
            gl.bindBuffer(gl.ARRAY_BUFFER, shipPosBuffer); gl.bufferData(gl.ARRAY_BUFFER, sPos2, gl.DYNAMIC_DRAW);
            if (this.a_instPos >= 0) { gl.enableVertexAttribArray(this.a_instPos); gl.vertexAttribPointer(this.a_instPos, 2, gl.FLOAT, false, 0, 0); }
            gl.bindBuffer(gl.ARRAY_BUFFER, shipColorBuffer); gl.bufferData(gl.ARRAY_BUFFER, sColor2, gl.DYNAMIC_DRAW);
            if (this.a_instColor >= 0) { gl.enableVertexAttribArray(this.a_instColor); gl.vertexAttribPointer(this.a_instColor, 3, gl.FLOAT, false, 0, 0); }
            gl.bindBuffer(gl.ARRAY_BUFFER, shipSizeBuffer); gl.bufferData(gl.ARRAY_BUFFER, sSize2, gl.DYNAMIC_DRAW);
            if (this.a_instSize >= 0) { gl.enableVertexAttribArray(this.a_instSize); gl.vertexAttribPointer(this.a_instSize, 1, gl.FLOAT, false, 0, 0); }
            gl.bindBuffer(gl.ARRAY_BUFFER, shipAngleBuffer); gl.bufferData(gl.ARRAY_BUFFER, sAngle2, gl.DYNAMIC_DRAW);
            if (this.a_instAngle >= 0) { gl.enableVertexAttribArray(this.a_instAngle); gl.vertexAttribPointer(this.a_instAngle, 1, gl.FLOAT, false, 0, 0); }
            gl.bindBuffer(gl.ARRAY_BUFFER, shipShieldBuffer); gl.bufferData(gl.ARRAY_BUFFER, sShield2, gl.DYNAMIC_DRAW);
            if (this.a_instShield >= 0) { gl.enableVertexAttribArray(this.a_instShield); gl.vertexAttribPointer(this.a_instShield, 1, gl.FLOAT, false, 0, 0); }
            if (this.a_instType >= 0) { gl.bindBuffer(gl.ARRAY_BUFFER, nonShipTypeBuffer); gl.bufferData(gl.ARRAY_BUFFER, sType2, gl.DYNAMIC_DRAW); gl.enableVertexAttribArray(this.a_instType); gl.vertexAttribPointer(this.a_instType, 1, gl.FLOAT, false, 0, 0); }

            if (webgl2) {
              if (this.a_instPos >= 0) gl.vertexAttribDivisor(this.a_instPos, 1);
              if (this.a_instColor >= 0) gl.vertexAttribDivisor(this.a_instColor, 1);
              if (this.a_instSize >= 0) gl.vertexAttribDivisor(this.a_instSize, 1);
              if (this.a_instAngle >= 0) gl.vertexAttribDivisor(this.a_instAngle, 1);
              if (this.a_instShield >= 0) gl.vertexAttribDivisor(this.a_instShield, 1);
              if (this.a_instType >= 0) gl.vertexAttribDivisor(this.a_instType, 1);
              gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, sCount2);
              if (this.a_instPos >= 0) gl.vertexAttribDivisor(this.a_instPos, 0);
              if (this.a_instColor >= 0) gl.vertexAttribDivisor(this.a_instColor, 0);
              if (this.a_instSize >= 0) gl.vertexAttribDivisor(this.a_instSize, 0);
              if (this.a_instAngle >= 0) gl.vertexAttribDivisor(this.a_instAngle, 0);
              if (this.a_instShield >= 0) gl.vertexAttribDivisor(this.a_instShield, 0);
              if (this.a_instType >= 0) gl.vertexAttribDivisor(this.a_instType, 0);
            } else if (extInstanced) {
              if (this.a_instPos >= 0) extInstanced.vertexAttribDivisorANGLE(this.a_instPos, 1);
              if (this.a_instColor >= 0) extInstanced.vertexAttribDivisorANGLE(this.a_instColor, 1);
              if (this.a_instSize >= 0) extInstanced.vertexAttribDivisorANGLE(this.a_instSize, 1);
              if (this.a_instAngle >= 0) extInstanced.vertexAttribDivisorANGLE(this.a_instAngle, 1);
              if (this.a_instShield >= 0) extInstanced.vertexAttribDivisorANGLE(this.a_instShield, 1);
              if (this.a_instType >= 0) extInstanced.vertexAttribDivisorANGLE(this.a_instType, 1);
              extInstanced.drawArraysInstancedANGLE(gl.TRIANGLE_STRIP, 0, 4, sCount2);
              if (this.a_instPos >= 0) extInstanced.vertexAttribDivisorANGLE(this.a_instPos, 0);
              if (this.a_instColor >= 0) extInstanced.vertexAttribDivisorANGLE(this.a_instColor, 0);
              if (this.a_instSize >= 0) extInstanced.vertexAttribDivisorANGLE(this.a_instSize, 0);
              if (this.a_instAngle >= 0) extInstanced.vertexAttribDivisorANGLE(this.a_instAngle, 0);
              if (this.a_instShield >= 0) extInstanced.vertexAttribDivisorANGLE(this.a_instShield, 0);
              if (this.a_instType >= 0) extInstanced.vertexAttribDivisorANGLE(this.a_instType, 0);
            } else {
              for (let i=0;i<sCount2;i++){
                const px = sPos2[i*2+0], py = sPos2[i*2+1];
                const cr = sColor2[i*3+0], cg = sColor2[i*3+1], cb = sColor2[i*3+2];
                const sz = sSize2[i]; const ang = sAngle2[i]; const sh = sShield2[i];
                if (this.a_instPos >= 0) gl.vertexAttrib2f(this.a_instPos, px, py);
                if (this.a_instColor >= 0) gl.vertexAttrib3f(this.a_instColor, cr, cg, cb);
                if (this.a_instSize >= 0) gl.vertexAttrib1f(this.a_instSize, sz);
                if (this.a_instAngle >= 0) gl.vertexAttrib1f(this.a_instAngle, ang);
                if (this.a_instShield >= 0) gl.vertexAttrib1f(this.a_instShield, sh);
                if (this.a_instType >= 0) gl.vertexAttrib1f(this.a_instType, sType2[i]);
                gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
              }
            }
          }
        } else {
          // For each group create/ensure texture and draw instanced
          for (const k in groups) {
            const g = groups[k];
          const atlasInfo = g.atlas;
          const ensured = this._ensureAtlasTexture ? this._ensureAtlasTexture(g.ships[0].type, atlasInfo.baseRadius, atlasInfo) : null;
          if (!ensured) continue;
          const texObj = ensured.tex || ensured;

          const count = g.ships.length;
          const { pos: posA, color: colorA, size: sizeA, angle: angleA, shield: shieldA } = buildShipArrays(g.ships);

          // Bind textured program and set uniforms
          gl.useProgram(this._texturedProgram);
          gl.uniform2f(this._t_u_resolution, W, H);
          // bind atlas texture to unit 0
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, texObj);
          if (this._t_u_atlas) gl.uniform1i(this._t_u_atlas, 0);

          // quad attribute
          gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
          if (this._t_a_quadPos >= 0) { gl.enableVertexAttribArray(this._t_a_quadPos); gl.vertexAttribPointer(this._t_a_quadPos, 2, gl.FLOAT, false, 0, 0); }

          // upload per-instance arrays into ship buffers and bind to textured attribs
          gl.bindBuffer(gl.ARRAY_BUFFER, shipPosBuffer); gl.bufferData(gl.ARRAY_BUFFER, posA, gl.DYNAMIC_DRAW);
          if (this._t_a_instPos >= 0) { gl.enableVertexAttribArray(this._t_a_instPos); gl.vertexAttribPointer(this._t_a_instPos, 2, gl.FLOAT, false, 0, 0); }
          gl.bindBuffer(gl.ARRAY_BUFFER, shipColorBuffer); gl.bufferData(gl.ARRAY_BUFFER, colorA, gl.DYNAMIC_DRAW);
          if (this._t_a_instColor >= 0) { gl.enableVertexAttribArray(this._t_a_instColor); gl.vertexAttribPointer(this._t_a_instColor, 3, gl.FLOAT, false, 0, 0); }
          gl.bindBuffer(gl.ARRAY_BUFFER, shipSizeBuffer); gl.bufferData(gl.ARRAY_BUFFER, sizeA, gl.DYNAMIC_DRAW);
          if (this._t_a_instSize >= 0) { gl.enableVertexAttribArray(this._t_a_instSize); gl.vertexAttribPointer(this._t_a_instSize, 1, gl.FLOAT, false, 0, 0); }
          gl.bindBuffer(gl.ARRAY_BUFFER, shipAngleBuffer); gl.bufferData(gl.ARRAY_BUFFER, angleA, gl.DYNAMIC_DRAW);
          if (this._t_a_instAngle >= 0) { gl.enableVertexAttribArray(this._t_a_instAngle); gl.vertexAttribPointer(this._t_a_instAngle, 1, gl.FLOAT, false, 0, 0); }
          gl.bindBuffer(gl.ARRAY_BUFFER, shipShieldBuffer); gl.bufferData(gl.ARRAY_BUFFER, shieldA, gl.DYNAMIC_DRAW);
          if (this._t_a_instShield >= 0) { gl.enableVertexAttribArray(this._t_a_instShield); gl.vertexAttribPointer(this._t_a_instShield, 1, gl.FLOAT, false, 0, 0); }

          // Draw instanced
          if (webgl2) {
            if (this._t_a_instPos >= 0) gl.vertexAttribDivisor(this._t_a_instPos, 1);
            if (this._t_a_instColor >= 0) gl.vertexAttribDivisor(this._t_a_instColor, 1);
            if (this._t_a_instSize >= 0) gl.vertexAttribDivisor(this._t_a_instSize, 1);
            if (this._t_a_instAngle >= 0) gl.vertexAttribDivisor(this._t_a_instAngle, 1);
            if (this._t_a_instShield >= 0) gl.vertexAttribDivisor(this._t_a_instShield, 1);
            gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count);
            if (this._t_a_instPos >= 0) gl.vertexAttribDivisor(this._t_a_instPos, 0);
            if (this._t_a_instColor >= 0) gl.vertexAttribDivisor(this._t_a_instColor, 0);
            if (this._t_a_instSize >= 0) gl.vertexAttribDivisor(this._t_a_instSize, 0);
            if (this._t_a_instAngle >= 0) gl.vertexAttribDivisor(this._t_a_instAngle, 0);
            if (this._t_a_instShield >= 0) gl.vertexAttribDivisor(this._t_a_instShield, 0);
          } else if (extInstanced) {
            if (this._t_a_instPos >= 0) extInstanced.vertexAttribDivisorANGLE(this._t_a_instPos, 1);
            if (this._t_a_instColor >= 0) extInstanced.vertexAttribDivisorANGLE(this._t_a_instColor, 1);
            if (this._t_a_instSize >= 0) extInstanced.vertexAttribDivisorANGLE(this._t_a_instSize, 1);
            if (this._t_a_instAngle >= 0) extInstanced.vertexAttribDivisorANGLE(this._t_a_instAngle, 1);
            if (this._t_a_instShield >= 0) extInstanced.vertexAttribDivisorANGLE(this._t_a_instShield, 1);
            extInstanced.drawArraysInstancedANGLE(gl.TRIANGLE_STRIP, 0, 4, count);
            if (this._t_a_instPos >= 0) extInstanced.vertexAttribDivisorANGLE(this._t_a_instPos, 0);
            if (this._t_a_instColor >= 0) extInstanced.vertexAttribDivisorANGLE(this._t_a_instColor, 0);
            if (this._t_a_instSize >= 0) extInstanced.vertexAttribDivisorANGLE(this._t_a_instSize, 0);
            if (this._t_a_instAngle >= 0) extInstanced.vertexAttribDivisorANGLE(this._t_a_instAngle, 0);
            if (this._t_a_instShield >= 0) extInstanced.vertexAttribDivisorANGLE(this._t_a_instShield, 0);
          } else {
            for (let i=0;i<count;i++){
              const px = posA[i*2+0], py = posA[i*2+1];
              const cr = colorA[i*3+0], cg = colorA[i*3+1], cb = colorA[i*3+2];
              const sz = sizeA[i]; const ang = angleA[i]; const sh = shieldA[i];
              if (this._t_a_instPos >= 0) gl.vertexAttrib2f(this._t_a_instPos, px, py);
              if (this._t_a_instColor >= 0) gl.vertexAttrib3f(this._t_a_instColor, cr, cg, cb);
              if (this._t_a_instSize >= 0) gl.vertexAttrib1f(this._t_a_instSize, sz);
              if (this._t_a_instAngle >= 0) gl.vertexAttrib1f(this._t_a_instAngle, ang);
              if (this._t_a_instShield >= 0) gl.vertexAttrib1f(this._t_a_instShield, sh);
              gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
            }
          }
        }
      }
  };

  // Attach destroy after the object to avoid any parser/listing edge-cases inside the literal
  renderer.destroy = function() {
    if (gl) {
      try {
        if (quadBuffer) gl.deleteBuffer(quadBuffer);
        if (shipPosBuffer) gl.deleteBuffer(shipPosBuffer);
        if (shipColorBuffer) gl.deleteBuffer(shipColorBuffer);
        if (shipSizeBuffer) gl.deleteBuffer(shipSizeBuffer);
        if (shipAngleBuffer) gl.deleteBuffer(shipAngleBuffer);
        if (shipShieldBuffer) gl.deleteBuffer(shipShieldBuffer);
        if (nonShipPosBuffer) gl.deleteBuffer(nonShipPosBuffer);
        if (nonShipColorBuffer) gl.deleteBuffer(nonShipColorBuffer);
        if (nonShipSizeBuffer) gl.deleteBuffer(nonShipSizeBuffer);
        if (nonShipAngleBuffer) gl.deleteBuffer(nonShipAngleBuffer);
        if (nonShipShieldBuffer) gl.deleteBuffer(nonShipShieldBuffer);
        if (nonShipTypeBuffer) gl.deleteBuffer(nonShipTypeBuffer);
        if (program) gl.deleteProgram(program);
        if (renderer._texturedProgram) gl.deleteProgram(renderer._texturedProgram);
        if (renderer._atlasTextures) {
          for (const t in renderer._atlasTextures) {
            const bySize = renderer._atlasTextures[t];
            for (const k in bySize) {
              try { if (bySize[k] && bySize[k].tex) gl.deleteTexture(bySize[k].tex); } catch(e){}
            }
          }
        }
        if (tex) gl.deleteTexture(tex);
      } catch (e) {}
      gl = null;
    }
    if (typeof window !== 'undefined' && handleResize) { window.removeEventListener('resize', handleResize); }
    running = false;
  };

  return renderer;
}

