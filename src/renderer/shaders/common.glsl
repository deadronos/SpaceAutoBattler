// Common GLSL utilities shared across multiple shaders
// This file is imported at runtime via string concatenation

// Simplified noise function for vec3 coordinates
// Based on implementation by trisomie21 (https://www.shadertoy.com/view/lsf3RH)
// Used for procedural noise generation in star shaders
float snoise(vec3 uv, float res) {
  const vec3 s = vec3(1e0, 1e2, 1e4);
  
  uv *= res;
  
  vec3 uv0 = floor(mod(uv, res)) * s;
  vec3 uv1 = floor(mod(uv + vec3(1.0), res)) * s;
  
  vec3 f = fract(uv);
  f = f * f * (3.0 - 2.0 * f);
  
  vec4 v = vec4(
    uv0.x + uv0.y + uv0.z,
    uv1.x + uv0.y + uv0.z,
    uv0.x + uv1.y + uv0.z,
    uv1.x + uv1.y + uv0.z
  );
  
  vec4 r = fract(sin(v * 1e-3) * 1e5);
  float r0 = mix(mix(r.x, r.y, f.x), mix(r.z, r.w, f.x), f.y);
  
  r = fract(sin((v + uv1.z - uv0.z) * 1e-3) * 1e5);
  float r1 = mix(mix(r.x, r.y, f.x), mix(r.z, r.w, f.x), f.y);
  
  return mix(r0, r1, f.z) * 2.0 - 1.0;
}

// Simple hash function for float input
// Returns pseudo-random value in range [0, 1)
float hash(float x) {
  return fract(sin(x) * 43758.5453123);
}

// Hash function for vec2 input
// Returns pseudo-random value in range [0, 1)
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
