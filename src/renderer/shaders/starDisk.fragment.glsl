precision highp float;

varying vec2 vUv;

uniform float uTime;
uniform float uTimeScale;
uniform float uBrightness;
uniform float uRadius;
uniform float uAspect;
uniform float uOpacity;
uniform float uCoronaScale1;
uniform float uCoronaScale2;
uniform float uCoronaIntensity;
uniform float uNoiseScale;
uniform float uCoronaFalloff;
uniform vec3 uColorCore;
uniform vec3 uColorPrimary;
uniform vec3 uColorSecondary;
uniform float uTextureMix;
uniform float uTextureFlicker;
uniform sampler2D uTextureOrganic;
uniform sampler2D uTextureNoise;

float snoise(vec3 uv, float res) {
  const vec3 s = vec3(1.0, 100.0, 10000.0);
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
  vec4 r = fract(sin(v * 0.001) * 100000.0);
  float r0 = mix(mix(r.x, r.y, f.x), mix(r.z, r.w, f.x), f.y);
  r = fract(sin((v + uv1.z - uv0.z) * 0.001) * 100000.0);
  float r1 = mix(mix(r.x, r.y, f.x), mix(r.z, r.w, f.x), f.y);
  return mix(r0, r1, f.z) * 2.0 - 1.0;
}

void main() {
  vec2 p = vUv * 2.0 - 1.0;
  p.x *= uAspect;
  float dist = length(p);
  if (dist > 1.2) {
    discard;
  }

  float time = uTime * uTimeScale;
  float fade = pow(length(2.0 * p), 0.5);
  float angle = atan(p.x, p.y) / 6.28318530718;
  vec3 coord = vec3(angle, dist * uNoiseScale, time * 0.1);

  float angleWrapped = fract(angle + 0.5);
  float radial = clamp(dist, 0.0, 1.0);
  vec2 organicUv = vec2(angleWrapped * 2.0 + time * 0.02, pow(radial, 0.8));
  vec3 organicSample = texture2D(uTextureOrganic, organicUv).rgb;
  float organicLuma = dot(organicSample, vec3(0.299, 0.587, 0.114));

  vec2 noiseUv = vec2(angleWrapped * 12.0 + time * 0.1, radial * 6.0 + time * 0.04);
  vec4 noiseSample = texture2D(uTextureNoise, noiseUv + vec2(time * 0.01, -time * 0.015));
  float noiseFlicker = mix(1.0 - uTextureFlicker, 1.0 + uTextureFlicker, clamp(noiseSample.a, 0.0, 1.0));

  float drift1 = abs(snoise(coord + vec3(0.0, -time * 0.35, time * 0.02), max(1.0, uCoronaScale1)));
  float drift2 = abs(snoise(coord + vec3(0.0, -time * 0.15, time * 0.02), max(1.0, uCoronaScale2)));

  float fVal1 = 1.0 - fade;
  float fVal2 = 1.0 - fade;
  for (int i = 1; i <= 6; i++) {
    float power = pow(2.0, float(i + 1));
    float scale1 = power * 10.0 * (drift1 + 1.0);
    float scale2 = power * 25.0 * (drift2 + 1.0);
    fVal1 += (0.5 / power) * snoise(coord + vec3(0.0, -time, time * 0.2), scale1);
    fVal2 += (0.5 / power) * snoise(coord + vec3(0.0, -time, time * 0.2), scale2);
  }

  float corona = pow(max(fVal1, 0.0) * max(1.1 - fade, 0.0), 2.0) * 45.0;
  corona += pow(max(fVal2, 0.0) * max(1.1 - fade, 0.0), 2.0) * 45.0;
  float organicGain = mix(1.0, 0.55 + organicLuma * 1.6, clamp(uTextureMix, 0.0, 1.0));
  corona *= uCoronaIntensity * (1.2 - drift1 * 0.6) * organicGain * noiseFlicker;

  float core = smoothstep(uRadius * 0.25, uRadius * 0.6, 1.0 - dist);
  float rim = smoothstep(uRadius * 0.0, uRadius * 0.3, 1.0 - dist) - core;

  vec3 color = vec3(0.0);
  color += uColorCore * (core * (0.6 + uBrightness * 0.4));
  color += uColorPrimary * (rim * (0.4 + uBrightness * 0.6));
  vec3 organicTint = mix(vec3(1.0), organicSample, clamp(uTextureMix, 0.0, 1.0));
  color += (uColorSecondary * (0.2 + uBrightness * 0.3) + uColorPrimary * 0.1) * corona * 0.02;
  color *= mix(vec3(1.0), organicTint, 0.35 * clamp(uTextureMix, 0.0, 1.0));
  color += organicSample * (rim * 0.25 * clamp(uTextureMix, 0.0, 1.0));
  color += noiseSample.rgb * (rim * 0.1 * clamp(uTextureMix, 0.0, 1.0));

  float outerGlow = pow(max(1.0 - dist, 0.0), 1.2) * (0.5 + uBrightness * 0.5);
  color += uColorSecondary * outerGlow * 0.6;

  float alphaCore = pow(max(1.0 - dist, 0.0), uCoronaFalloff);
  float alpha = alphaCore + corona * 0.015;
  alpha = clamp(alpha * uOpacity * (0.6 + uBrightness * 0.4) * organicGain, 0.0, 1.0);

  if (alpha <= 0.002) {
    discard;
  }

  gl_FragColor = vec4(color, alpha);
}
