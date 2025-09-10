/**
 * Shader-based skybox animation for moving CPU work to GPU
 * Performance optimization - replaces CPU-based pixel manipulation with GPU shader
 */

export const skyboxVertexShader = `
  varying vec3 vWorldPosition;
  varying vec2 vUv;
  
  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    vUv = uv;
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const skyboxFragmentShader = `
  uniform float time;
  uniform float twinkleSpeed;
  uniform sampler2D starfieldTexture;
  uniform vec3 baseColor;
  
  varying vec3 vWorldPosition;
  varying vec2 vUv;
  
  // Pseudo-random function for consistent noise
  float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
  }
  
  // Noise function for star twinkling
  float noise(vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);
    
    float a = random(i);
    float b = random(i + vec2(1.0, 0.0));
    float c = random(i + vec2(0.0, 1.0));
    float d = random(i + vec2(1.0, 1.0));
    
    vec2 u = f * f * (3.0 - 2.0 * f);
    
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }
  
  void main() {
    // Sample the base starfield texture
    vec4 texColor = texture2D(starfieldTexture, vUv);
    
    // Calculate star brightness threshold (bright stars)
    float starMask = step(0.7, (texColor.r + texColor.g + texColor.b) / 3.0);
    
    // Generate animated twinkling effect on GPU
    vec2 starPos = vUv * 512.0; // Scale for noise variation
    float twinkle = noise(starPos + time * twinkleSpeed * 0.1) * 0.3 + 0.7;
    
    // Apply twinkling only to bright pixels (stars)
    vec3 finalColor = texColor.rgb;
    finalColor = mix(finalColor, finalColor * twinkle, starMask);
    
    // Blend with base space color
    finalColor = mix(baseColor, finalColor, texColor.a);
    
    gl_FragColor = vec4(finalColor, 1.0);
  }
`;
