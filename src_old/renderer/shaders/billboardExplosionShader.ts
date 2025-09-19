/**
 * Billboard Explosion Shader
 *
 * Enhanced additive billboard shader for particle explosions with animated
 * glow, rim-lighting, and per-instance flicker to give the effect more "pop".
 */

export const billboardExplosionVertexShader = `
  // Per-instance attributes (for instanced rendering)
  attribute vec3 instancePosition;
  attribute float instanceSize;
  attribute vec4 instanceColor;
  attribute float instanceAge;
  attribute float instanceLifetime;
  attribute float instanceSeed;
  
  // Note: standard attributes/uniforms like 'position', 'uv', 'modelViewMatrix',
  // 'projectionMatrix', 'viewMatrix', and 'cameraPosition' are provided by
  // Three.js when using ShaderMaterial and must NOT be redeclared to avoid
  // multiple-definition compilation errors across platforms.
  
  // Shader parameters
  uniform float billboardScale;
  
  // Varyings to fragment shader
  varying vec2 vUv;
  varying vec4 vColor;
  varying float vLifeRatio;
  varying float vFadeAlpha;
  varying float vSeed;
  
  void main() {
    vUv = uv;
    vColor = instanceColor;
    vSeed = instanceSeed;
    
    // Calculate normalized lifetime (0.0 = birth, 1.0 = death)
    vLifeRatio = clamp(instanceAge / max(instanceLifetime, 0.001), 0.0, 1.0);
    // Billboard calculation - always face the camera
    vec3 worldPosition = instancePosition;
    
    // Get camera forward vector (negative Z in view space)
    vec3 cameraForward = -normalize((viewMatrix * vec4(0.0, 0.0, -1.0, 0.0)).xyz);
    vec3 cameraUp = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
    vec3 cameraRight = normalize(cross(cameraForward, cameraUp));
    
    // Apply billboard scale and instance size
    float finalSize = instanceSize * billboardScale;
    
    // Calculate billboard vertex position
    vec3 localPosition = cameraRight * position.x * finalSize + cameraUp * position.y * finalSize;
    vec4 worldPos = vec4(worldPosition + localPosition, 1.0);
    
    // Optional distance-based fade hook (not currently used)
    float distanceToCamera = length(cameraPosition - worldPosition);
    vFadeAlpha = 1.0; // Placeholder for potential LOD-driven fade
    
    gl_Position = projectionMatrix * modelViewMatrix * worldPos;
  }
`;

export const billboardExplosionFragmentShader = `
  // Uniforms for texture and color control
  uniform sampler2D explosionTexture;
  uniform float fadeInDuration;
  uniform float fadeOutStart;
  uniform float softEdgePower;
  uniform float colorIntensity;
  uniform float glowIntensity;
  uniform float glowFalloff;
  uniform float rimLocation;
  uniform float rimSharpness;
  uniform float heatExponent;
  uniform float pulseFrequency;
  uniform float pulseAmplitude;
  uniform float sparkleIntensity;
  uniform float alphaMultiplier;
  uniform float minAlpha;
  
  // Color stops for lifetime interpolation
  uniform vec3 colorStop1;    // Birth color (t=0.0)
  uniform vec3 colorStop2;    // Mid-life color (t=0.5)
  uniform vec3 colorStop3;    // Death color (t=1.0)
  uniform float colorStop1Pos;
  uniform float colorStop2Pos;
  uniform float colorStop3Pos;
  
  // Varyings from vertex shader
  varying vec2 vUv;
  varying vec4 vColor;
  varying float vLifeRatio;
  varying float vFadeAlpha;
  varying float vSeed;
  
  vec3 interpolateColorStops(float t) {
    float pos1 = clamp(colorStop1Pos, 0.0, 1.0);
    float pos2 = clamp(colorStop2Pos, pos1, 1.0);
    float pos3 = clamp(colorStop3Pos, pos2, 1.0);
    
    if (t <= pos1) {
      return colorStop1;
    } else if (t <= pos2) {
      float factor = smoothstep(pos1, pos2, t);
      return mix(colorStop1, colorStop2, factor);
    } else {
      float factor = smoothstep(pos2, pos3, t);
      return mix(colorStop2, colorStop3, factor);
    }
  }
  
  float calculateLifetimeFade(float t) {
    float fadeIn = smoothstep(0.0, fadeInDuration, t);
    float fadeOut = 1.0 - smoothstep(fadeOutStart, 1.0, t);
    return fadeIn * fadeOut;
  }
  
  void main() {
    vec4 texColor = texture2D(explosionTexture, vUv);
    vec3 dynamicColor = interpolateColorStops(vLifeRatio);
    vec3 baseColor = dynamicColor * vColor.rgb;
    
    vec2 centeredUv = vUv - 0.5;
    float radial = length(centeredUv) * 2.0; // 0.0 at center, ~1.4 at far corners
    
    // Layered brightness: core glow, expanding rim, heat halo
    float coreGlow = glowIntensity * exp(-radial * glowFalloff);
    float rim = pow(max(0.0, 1.0 - abs(radial - rimLocation) * rimSharpness), 3.0);
    float heat = pow(max(0.0, 1.0 - radial), heatExponent);
    
    float flickerPhase = vLifeRatio * pulseFrequency + vSeed * 6.2831853;
    float flicker = 1.0 + sin(flickerPhase) * pulseAmplitude;
        float sparkle = 1.0 + (sin((radial + vSeed) * 24.0) * 0.5 + 0.5) * sparkleIntensity;
        float brightness = (coreGlow + rim + heat) * flicker * sparkle;
    
    vec3 finalColor = baseColor * colorIntensity * brightness;
    
    float lifetimeFade = calculateLifetimeFade(vLifeRatio);
    float textureAlpha = pow(texColor.r, softEdgePower);
    float instanceAlpha = vColor.a * vFadeAlpha;
    
    float radialFade = 1.0 - smoothstep(0.85, 1.05, radial);
    float brightnessAlpha = clamp(coreGlow * 0.6 + heat, 0.0, 1.5);

    float finalAlpha = textureAlpha * instanceAlpha * lifetimeFade * radialFade;
    finalAlpha *= mix(1.0, brightnessAlpha, 0.6);
    finalAlpha *= alphaMultiplier;

    float minAlphaValue = minAlpha * lifetimeFade * radialFade;
    finalAlpha = max(finalAlpha, minAlphaValue);
    finalAlpha = clamp(finalAlpha, 0.0, 1.0);

    gl_FragColor = vec4(finalColor, finalAlpha);
  }
`;

export interface BillboardExplosionShaderParams {
  explosionTexture?: WebGLTexture;
  fadeInDuration?: number;
  fadeOutStart?: number;
  billboardScale?: number;
  softEdgePower?: number;
  colorIntensity?: number;
  glowIntensity?: number;
  glowFalloff?: number;
  rimLocation?: number;
  rimSharpness?: number;
  heatExponent?: number;
  pulseFrequency?: number;
  pulseAmplitude?: number;
  sparkleIntensity?: number;
  alphaMultiplier?: number;
  minAlpha?: number;
  colorStop1?: [number, number, number];
  colorStop2?: [number, number, number];
  colorStop3?: [number, number, number];
  colorStop1Pos?: number;
  colorStop2Pos?: number;
  colorStop3Pos?: number;
}

export const DefaultBillboardExplosionParams: Required<BillboardExplosionShaderParams> = {
  explosionTexture: null as unknown as WebGLTexture,
  fadeInDuration: 0.08,
  fadeOutStart: 0.82,
  billboardScale: 1.0,
  softEdgePower: 2.0,
  colorIntensity: 1.4,
  glowIntensity: 2.2,
  glowFalloff: 1.9,
  rimLocation: 0.72,
  rimSharpness: 8.0,
  heatExponent: 2.4,
  pulseFrequency: 10.0,
  pulseAmplitude: 0.25,
  sparkleIntensity: 0.08,
  alphaMultiplier: 1.35,
  minAlpha: 0.14,
  colorStop1: [1.0, 0.98, 0.85],
  colorStop2: [1.0, 0.48, 0.02],
  colorStop3: [0.24, 0.02, 0.0],
  colorStop1Pos: 0.0,
  colorStop2Pos: 0.42,
  colorStop3Pos: 1.0,
};

export const ExplosionColorSchemes = {
  fire: {
    colorStop1: [1.0, 0.98, 0.85],
    colorStop2: [1.0, 0.55, 0.0],
    colorStop3: [0.27, 0.0, 0.0],
  },
  electric: {
    colorStop1: [1.0, 1.0, 1.0],
    colorStop2: [0.0, 1.0, 1.0],
    colorStop3: [0.0, 0.27, 1.0],
  },
  plasma: {
    colorStop1: [1.0, 0.0, 1.0],
    colorStop2: [0.5, 0.0, 1.0],
    colorStop3: [0.1, 0.0, 0.3],
  },
  toxic: {
    colorStop1: [0.8, 1.0, 0.0],
    colorStop2: [0.0, 0.8, 0.0],
    colorStop3: [0.0, 0.2, 0.1],
  },
  smoke: {
    colorStop1: [0.7, 0.7, 0.7],
    colorStop2: [0.4, 0.4, 0.4],
    colorStop3: [0.1, 0.1, 0.1],
  },
};

export function hexToVec3(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');

  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16) / 255;
    const g = parseInt(clean[1] + clean[1], 16) / 255;
    const b = parseInt(clean[2] + clean[2], 16) / 255;
    return [r, g, b];
  } else if (clean.length === 6) {
    const r = parseInt(clean.slice(0, 2), 16) / 255;
    const g = parseInt(clean.slice(2, 4), 16) / 255;
    const b = parseInt(clean.slice(4, 6), 16) / 255;
    return [r, g, b];
  } else {
    console.warn(`Invalid hex color format: ${hex}. Using white.`);
    return [1.0, 1.0, 1.0];
  }
}

export function colorOverrideToShaderParams(
  colorOverride?: string[],
): Partial<BillboardExplosionShaderParams> {
  if (!colorOverride || colorOverride.length === 0) {
    return {};
  }

  const colors = [...colorOverride];
  while (colors.length < 3) {
    colors.push(colors[colors.length - 1]);
  }

  return {
    colorStop1: hexToVec3(colors[0]),
    colorStop2: hexToVec3(colors[1]),
    colorStop3: hexToVec3(colors[2]),
  };
}
