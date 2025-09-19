/**
 * Shield effect vertex shader
 * Calculates normal vectors and view direction for rim lighting
 */
export const shieldVertexShader = `
  varying vec3 vNormal;
  varying vec3 vWorldNormal;
  varying vec3 vViewDir;
  
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewDir = normalize(mvPosition.xyz);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

/**
 * Shield effect fragment shader with hex grid and hit effects
 * Generates the main visual shield effect with complex GLSL
 */
export function createShieldFragmentShader(hitMax: number): string {
  return `
    uniform vec3 uColor;
    uniform float uTime;
    uniform float uOpacity;
    uniform vec3 uHitDir;
    uniform float uHitStrength;
    uniform float uHexDensity;
    uniform float uEdgeWidth;
    uniform int uHitCount;
    uniform vec3 uHitDirs[${hitMax}];
    uniform float uHitTimes[${hitMax}];
    uniform float uHitStrengths[${hitMax}];
    uniform float uHitWindow;
    uniform float uHexSplashRadius;
    uniform float uRippleAmplitude;
    uniform float uRippleSpeed;
    uniform float uRippleFalloff;
    uniform float uArcAlignStart;
    uniform float uArcAlignEnd;
    uniform float uArcAlphaScale;
    uniform float uArcColorScale;
    uniform float uDamageNormalizeBy;
    uniform float uDamageMinScale;
    uniform float uDamageMaxScale;
    
    varying vec3 vNormal;
    varying vec3 vWorldNormal;
    varying vec3 vViewDir;

    const float PI = 3.141592653589793;

    // Map a direction vector to spherical UV (lon/lat)
    vec2 dirToUV(vec3 n) {
      n = normalize(n);
      float lon = atan(n.z, n.x); // [-pi,pi]
      float lat = asin(clamp(n.y, -1.0, 1.0)); // [-pi/2,pi/2]
      return vec2((lon + PI) / (2.0*PI), (lat + PI*0.5) / PI);
    }

    // Convert 2D axial coordinates helpers for hex grid
    // From Red Blob Games hex grid guide (cube coordinates)
    vec3 axialToCube(vec2 a){ return vec3(a.x, a.y, -a.x - a.y); }
    vec2 cubeToAxial(vec3 c){ return vec2(c.x, c.y); }
    vec3 cubeRound(vec3 h){
      vec3 rh = round(h);
      vec3 diff = abs(rh - h);
      if (diff.x > diff.y && diff.x > diff.z) rh.x = -rh.y - rh.z;
      else if (diff.y > diff.z) rh.y = -rh.x - rh.z;
      else rh.z = -rh.x - rh.y;
      return rh;
    }
    float axialDistance(vec2 a, vec2 b){
      vec3 ac = axialToCube(a);
      vec3 bc = axialToCube(b);
      return max(abs(ac.x-bc.x), max(abs(ac.y-bc.y), abs(ac.z-bc.z)));
    }
    vec2 hexAxialFromUV(vec2 uv, float density){
      // Scale UV to hex space; density ~ number around equator
      vec2 p = uv * vec2(density, density);
      float q = (sqrt(3.0)/3.0 * p.x - 1.0/3.0 * p.y);
      float r = (2.0/3.0 * p.y);
      vec3 cube = cubeRound(vec3(q, r, -q - r));
      return cubeToAxial(cube);
    }
    // Distance to hex edge for visual grid lines
    float hexEdge(vec2 uv, float density){
      vec2 p = uv * vec2(density, density);
      // Get rounded cell center in axial, then back to local offset
      float q = (sqrt(3.0)/3.0 * p.x - 1.0/3.0 * p.y);
      float r = (2.0/3.0 * p.y);
      vec3 cube = cubeRound(vec3(q, r, -q - r));
      // Convert cube center back to 2D position in p-space
      vec2 center = vec2(
        sqrt(3.0)*(cube.x + 0.5*cube.y),
        1.5*cube.y
      );
      vec2 d = p - center; d = abs(d);
      // Signed distance to regular hex with circumradius=1
      float a = dot(vec2(sqrt(3.0), 1.0), d);
      float edge = a - 1.0;
      return edge;
    }
    
    void main() {
      // Rim lighting based on view angle
      float rim = pow(1.0 - max(0.0, dot(normalize(vNormal), -normalize(vViewDir))), 2.0);
      float pulse = 0.9 + 0.1 * sin(uTime * 6.28318 * 0.3);
      float alpha = uOpacity * (0.2 + 0.8 * rim) * pulse;

      // Directional hit highlight where normal aligns with hit direction
      float align = max(0.0, dot(normalize(vWorldNormal), normalize(uHitDir)));
      float arc = smoothstep(uArcAlignStart, uArcAlignEnd, align);
      vec3 col = uColor * (0.4 + 0.6 * rim);
      col += uHitStrength * arc * uArcColorScale * vec3(1.0, 0.9, 0.6);
      alpha += uHitStrength * arc * uArcAlphaScale;

      // Hex grid overlay and per-hex highlight
      vec2 uv = dirToUV(vWorldNormal);
      float edge = hexEdge(uv, uHexDensity);
      float gridLine = smoothstep(0.0, uEdgeWidth, max(0.0, -edge)); // brighten near edges
      col += gridLine * (uColor * 0.35 + vec3(0.05));

      // Highlight hex cell that matches any recent hit direction
      vec2 cell = hexAxialFromUV(uv, uHexDensity);
      float hexHighlight = 0.0;
      for (int i = 0; i < ${hitMax}; i++) {
        if (i >= uHitCount) break;
        vec2 hitUv = dirToUV(normalize(uHitDirs[i]));
        vec2 hitCell = hexAxialFromUV(hitUv, uHexDensity);
        // splash within axial distance threshold
        float dist = axialDistance(hitCell, cell);
        if (dist <= uHexSplashRadius + 0.001) {
          float t = max(0.0, uTime - uHitTimes[i]);
          float s = clamp(1.0 - t / uHitWindow, 0.0, 1.0);
          // damage-scaled
          s *= clamp(uHitStrengths[i] / uDamageNormalizeBy, uDamageMinScale, uDamageMaxScale);
          // radial ripple falloff across neighbors
          s *= exp(-uRippleFalloff * dist);
          hexHighlight = max(hexHighlight, s);
        }
      }
      // Add ripple pattern expanding from impact
      float ripple = 0.0;
      for (int i = 0; i < ${hitMax}; i++) {
        if (i >= uHitCount) break;
        float t = max(0.0, uTime - uHitTimes[i]);
        float w = clamp(1.0 - t / uHitWindow, 0.0, 1.0);
        // distance on sphere between this normal and impact dir
        float ang = acos(clamp(dot(normalize(vWorldNormal), normalize(uHitDirs[i])), -1.0, 1.0));
        float wave = sin(ang * 20.0 - t * uRippleSpeed * 6.28318);
        wave = max(0.0, wave) * w * uRippleAmplitude;
        ripple = max(ripple, wave);
      }
      col += hexHighlight * vec3(1.2, 1.0, 0.7) + ripple * vec3(0.6, 0.7, 1.0);
      alpha += hexHighlight * 0.5 + ripple * 0.3;

      gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
    }
  `;
}
