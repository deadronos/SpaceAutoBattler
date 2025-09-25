precision highp float;

varying vec2 vUv;

uniform float uTime;
uniform float uTimeScale;
uniform float uBrightness;
uniform float uRadius;
uniform float uAspectInv;
uniform float uOpacity;
uniform float uCoronaScale1;
uniform float uCoronaScale2;
uniform float uCoronaIntensity;
uniform float uNoiseScale;
uniform float uCoronaFalloff;
uniform float uTextureRadialPower;
uniform float uCoronaEdgeSoftness;
uniform float uBaseFillStrength;
uniform vec3 uColorCore;
uniform vec3 uColorPrimary;
uniform vec3 uColorSecondary;
uniform float uTextureMix;
uniform float uTextureFlicker;
uniform sampler2D uTextureOrganic;
uniform sampler2D uTextureNoise;
uniform float uCoreStrength;
uniform float uRimStrength;
uniform float uCoronaStrength;
uniform float uOuterGlowStrength;
uniform float uAlphaStrength;
uniform float uCoronaColorBlend;
uniform float uOrganicTiling;
uniform float uOrganicScrollSpeed;
uniform float uNoiseTiling;
uniform float uNoiseScrollSpeed;
uniform float uNoiseDriftSpeed;

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
  p.x *= uAspectInv;
  float dist = length(p);
  if (dist > 1.2) {
    discard;
  }

  float time = uTime * uTimeScale;
  float fade = pow(length(2.0 * p), 0.5);
  float angle = atan(p.x, p.y) / 6.28318530718;
  float radial = clamp(dist, 0.0, 1.0);
  float radialCoord = pow(radial, max(uTextureRadialPower, 0.2));
  vec3 coord = vec3(angle, radialCoord * uNoiseScale, time * 0.1);

  float swirl = sin(radialCoord * 6.0 + time * 0.25) * 0.04;
  float angleWrapped = fract(angle + 0.5 + swirl);
  vec2 organicUv = vec2(
    angleWrapped * 2.0 * uOrganicTiling + time * 0.02 * uOrganicScrollSpeed,
    radialCoord * uOrganicTiling
  );
  vec3 organicSample = texture2D(uTextureOrganic, organicUv).rgb;
  float organicLuma = dot(organicSample, vec3(0.299, 0.587, 0.114));

  vec2 noiseUv = vec2(
    angleWrapped * 12.0 * uNoiseTiling + time * 0.1 * uNoiseScrollSpeed,
    radialCoord * 6.0 * uNoiseTiling + time * 0.04 * uNoiseScrollSpeed
  );
  vec4 noiseSample = texture2D(
    uTextureNoise,
    noiseUv + vec2(time * 0.01 * uNoiseDriftSpeed, -time * 0.015 * uNoiseDriftSpeed)
  );
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

  float coronaEdge = pow(max(1.0 - radial, 0.0), clamp(uCoronaEdgeSoftness, 0.2, 3.0));
  float coronaEnvelope = pow(coronaEdge, 0.9);
  float corona = pow(max(fVal1, 0.0) * coronaEnvelope, 2.0) * 46.0;
  corona += pow(max(fVal2, 0.0) * coronaEnvelope, 2.0) * 58.0;
  float textureWeight = clamp(uTextureMix, 0.0, 1.0);
  float organicGain = mix(1.0, 0.6 + organicLuma * 1.4, textureWeight);
  corona *= uCoronaIntensity * (1.15 - drift1 * 0.55) * organicGain * noiseFlicker;

  float coreBase = smoothstep(uRadius * 0.25, uRadius * 0.6, 1.0 - dist);
  float rimBase = smoothstep(uRadius * 0.0, uRadius * 0.3, 1.0 - dist) - coreBase;
  float core = coreBase * uCoreStrength;
  float rim = max(rimBase, 0.0) * uRimStrength;

  vec3 color = vec3(0.0);
  color += uColorCore * (core * (0.68 + uBrightness * 0.32));
  color += uColorPrimary * (rim * (0.46 + uBrightness * 0.5));
  vec3 coronaColor = mix(uColorPrimary, uColorSecondary, clamp(uCoronaColorBlend, 0.0, 1.0));
  float coronaScaled = corona * uCoronaStrength;
  color += coronaColor * coronaScaled * 0.018;
  vec3 organicTint = mix(vec3(1.0), organicSample, 0.55 * textureWeight);
  vec3 noiseTint = mix(vec3(1.0), noiseSample.rgb, 0.25 * textureWeight);
  color = mix(color, color * organicTint, 0.42 * textureWeight);
  color += organicSample * (rim * 0.38 * textureWeight);
  color += noiseSample.rgb * (rim * 0.22 * textureWeight);

  float outerGlowBoost = 1.0 + max(0.0, 1.0 - clamp(uCoronaEdgeSoftness, 0.2, 3.0)) * 0.5;
  float outerGlow = pow(max(1.0 - dist, 0.0), 1.1) * (0.52 + uBrightness * 0.4) * uOuterGlowStrength * outerGlowBoost;
  color += uColorSecondary * outerGlow * 0.58;

  float midBand = clamp(1.0 - abs(radial - 0.55) * 1.8, 0.0, 1.0);
  float rimBand = clamp(1.0 - abs(radial - 0.88) * 6.0, 0.0, 1.0);
  float baseFill = pow(midBand, 2.0) + rimBand * 0.35;
  vec3 fillTint = mix(uColorCore, uColorSecondary, 0.45);
  float clampedBaseFillStrength = clamp(uBaseFillStrength, 0.0, 1.0);
  color += fillTint * baseFill * clampedBaseFillStrength;
  color += uColorSecondary * rimBand * clampedBaseFillStrength * 0.22;

  color *= noiseTint;
  color = clamp(color, 0.0, 1.0);

  float alphaCore = pow(max(1.0 - dist, 0.0), uCoronaFalloff);
  float alpha = alphaCore * mix(0.78, 1.12, clamp(1.0 - uCoronaEdgeSoftness, 0.0, 1.0));
  alpha += coronaScaled * 0.014;
  alpha += baseFill * clampedBaseFillStrength * 0.16;
  alpha += rimBand * clampedBaseFillStrength * 0.08;
  alpha = clamp(alpha * uOpacity * (0.62 + uBrightness * 0.28) * organicGain * uAlphaStrength, 0.0, 1.0);

  if (alpha <= 0.002) {
    discard;
  }

  gl_FragColor = vec4(color, alpha);
}
