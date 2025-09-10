/**
 * Billboard Explosion Shader
 *
 * Reference additive billboard shader for particle explosions with configurable
 * color stops, size, and soft-edge falloff parameters.
 *
 * Features:
 * - Automatic camera-facing billboarding
 * - Configurable color interpolation over lifetime
 * - Soft-edge falloff from texture alpha
 * - Additive blending for realistic fire/explosion effects
 * - Integration with colorOverride system
 */

export const billboardExplosionVertexShader = `
  // Standard vertex attributes
  attribute vec3 position;
  attribute vec2 uv;
  
  // Per-instance attributes (for instanced rendering)
  attribute vec3 instancePosition;
  attribute float instanceSize;
  attribute vec4 instanceColor;
  attribute float instanceAge;
  attribute float instanceLifetime;
  
  // Standard uniforms
  uniform mat4 modelViewMatrix;
  uniform mat4 projectionMatrix;
  uniform mat4 viewMatrix;
  uniform vec3 cameraPosition;
  
  // Shader parameters
  uniform float billboardScale;
  
  // Varyings to fragment shader
  varying vec2 vUv;
  varying vec4 vColor;
  varying float vLifeRatio;
  varying float vFadeAlpha;
  
  void main() {
    vUv = uv;
    vColor = instanceColor;
    
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
    
    // Calculate fade based on distance to camera (optional LOD)
    float distanceToCamera = length(cameraPosition - worldPosition);
    vFadeAlpha = 1.0; // Can be modified for distance-based fading
    
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
  
  /**
   * Interpolate between three color stops based on normalized time
   * Uses smoothstep for smooth transitions between stops
   */
  vec3 interpolateColorStops(float t) {
    // Normalize positions to ensure proper interpolation
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
  
  /**
   * Calculate alpha fade-in and fade-out over particle lifetime
   */
  float calculateLifetimeFade(float t) {
    // Fade in from birth
    float fadeIn = smoothstep(0.0, fadeInDuration, t);
    
    // Fade out approaching death
    float fadeOut = 1.0 - smoothstep(fadeOutStart, 1.0, t);
    
    return fadeIn * fadeOut;
  }
  
  void main() {
    // Sample the explosion texture (should be soft-circle or similar)
    vec4 texColor = texture2D(explosionTexture, vUv);
    
    // Calculate color based on particle lifetime
    vec3 dynamicColor = interpolateColorStops(vLifeRatio);
    
    // Apply color override from instance (if provided) or use dynamic color
    // vColor.rgb contains the override color or default white
    vec3 finalColor = dynamicColor * vColor.rgb * colorIntensity;
    
    // Calculate alpha components
    float lifetimeFade = calculateLifetimeFade(vLifeRatio);
    float textureAlpha = pow(texColor.r, softEdgePower); // Use red channel as luminance
    float instanceAlpha = vColor.a * vFadeAlpha;
    
    // Combine all alpha contributions
    float finalAlpha = textureAlpha * instanceAlpha * lifetimeFade;
    
    // Apply soft-edge falloff - additional radial fade for smoother edges
    vec2 center = vUv - 0.5;
    float radialDistance = length(center) * 2.0; // 0.0 at center, 1.0 at edge
    float radialFade = 1.0 - smoothstep(0.7, 1.0, radialDistance);
    finalAlpha *= radialFade;
    
    gl_FragColor = vec4(finalColor, finalAlpha);
  }
`;

/**
 * Shader parameter configuration
 * Maps to uniforms and provides sensible defaults
 */
export interface BillboardExplosionShaderParams {
  // Texture
  explosionTexture?: WebGLTexture;

  // Timing parameters
  fadeInDuration?: number; // How quickly particle fades in (0.0-1.0)
  fadeOutStart?: number; // When fade-out begins (0.0-1.0)

  // Visual parameters
  billboardScale?: number; // Overall size multiplier
  softEdgePower?: number; // Power for soft-edge falloff (higher = sharper)
  colorIntensity?: number; // Overall color intensity multiplier

  // Color stops (vec3 RGB values 0.0-1.0)
  colorStop1?: [number, number, number]; // Birth color
  colorStop2?: [number, number, number]; // Mid-life color
  colorStop3?: [number, number, number]; // Death color

  // Color stop positions (0.0-1.0)
  colorStop1Pos?: number;
  colorStop2Pos?: number;
  colorStop3Pos?: number;
}

/**
 * Default shader parameters
 * Provides fire-like explosion effect with smooth transitions
 */
export const DefaultBillboardExplosionParams: Required<BillboardExplosionShaderParams> = {
  // Texture will be set by renderer
  explosionTexture: null as any,

  // Timing - quick fade-in, long visibility, gradual fade-out
  fadeInDuration: 0.1,
  fadeOutStart: 0.7,

  // Visual - moderate billboard scale, soft edges, full intensity
  billboardScale: 1.0,
  softEdgePower: 2.2, // Gamma-corrected falloff
  colorIntensity: 1.2, // Slightly brighter for additive blending

  // Color stops - fire-like progression from white-hot to dark red
  colorStop1: [1.0, 0.98, 0.85], // Bright white-yellow (birth)
  colorStop2: [1.0, 0.55, 0.0], // Orange (mid-life)
  colorStop3: [0.27, 0.0, 0.0], // Dark red (death)

  // Color stop positions - even distribution with emphasis on mid-life
  colorStop1Pos: 0.0,
  colorStop2Pos: 0.4,
  colorStop3Pos: 1.0,
};

/**
 * Color scheme presets for common explosion types
 */
export const ExplosionColorSchemes = {
  fire: {
    colorStop1: [1.0, 0.98, 0.85], // Hot white
    colorStop2: [1.0, 0.55, 0.0], // Orange
    colorStop3: [0.27, 0.0, 0.0], // Dark red
  },

  electric: {
    colorStop1: [1.0, 1.0, 1.0], // Pure white
    colorStop2: [0.0, 1.0, 1.0], // Cyan
    colorStop3: [0.0, 0.27, 1.0], // Blue
  },

  plasma: {
    colorStop1: [1.0, 0.0, 1.0], // Magenta
    colorStop2: [0.5, 0.0, 1.0], // Purple
    colorStop3: [0.1, 0.0, 0.3], // Dark purple
  },

  toxic: {
    colorStop1: [0.8, 1.0, 0.0], // Bright yellow-green
    colorStop2: [0.0, 0.8, 0.0], // Green
    colorStop3: [0.0, 0.2, 0.1], // Dark green
  },

  smoke: {
    colorStop1: [0.7, 0.7, 0.7], // Light gray
    colorStop2: [0.4, 0.4, 0.4], // Medium gray
    colorStop3: [0.1, 0.1, 0.1], // Dark gray
  },
};

/**
 * Utility function to convert hex color to vec3
 * Supports: #rrggbb, #rgb formats
 */
export function hexToVec3(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');

  if (clean.length === 3) {
    // #rgb format
    const r = parseInt(clean[0] + clean[0], 16) / 255;
    const g = parseInt(clean[1] + clean[1], 16) / 255;
    const b = parseInt(clean[2] + clean[2], 16) / 255;
    return [r, g, b];
  } else if (clean.length === 6) {
    // #rrggbb format
    const r = parseInt(clean.slice(0, 2), 16) / 255;
    const g = parseInt(clean.slice(2, 4), 16) / 255;
    const b = parseInt(clean.slice(4, 6), 16) / 255;
    return [r, g, b];
  } else {
    console.warn(`Invalid hex color format: ${hex}. Using white.`);
    return [1.0, 1.0, 1.0];
  }
}

/**
 * Convert colorOverride array to shader parameters
 * Maps the color override system to shader uniforms
 */
export function colorOverrideToShaderParams(
  colorOverride?: string[],
): Partial<BillboardExplosionShaderParams> {
  if (!colorOverride || colorOverride.length === 0) {
    return {}; // Use defaults
  }

  // Ensure we have at least 3 colors, repeat last color if needed
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
