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
uniform float uCoreRadiusInner;
uniform float uCoreRadiusOuter;
uniform float uCoreTightness;
uniform float uHaloFalloff;
uniform float uCoreHotspotMix;
uniform float uCoreDetailStrength;
uniform float uCoreDetailNoise;
uniform float uCoronaFilamentStrength;
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
uniform float uSwirlRate;
uniform float uSectorDarkeningStrength;

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

  // Enhanced swirl effect for organic texture sampling
  float swirlAmount = sin(radialCoord * 6.0 + time * 0.25) * 0.04;
  float enhancedSwirl = swirlAmount + sin(radialCoord * 3.14159 + time * uSwirlRate * 0.5) * uSwirlRate * 0.02;
  float angleWrapped = fract(angle + 0.5 + enhancedSwirl);
  
  // Sector darkening for flame-like patterns
  float sectorModulation = 1.0;
  if (uSectorDarkeningStrength > 0.0) {
    float sectorAngle = angle * 8.0 + time * 0.1;
    float sectorNoise = snoise(vec3(sectorAngle, radialCoord * 2.0, time * 0.05), 4.0);
    sectorModulation = mix(1.0, 0.4 + abs(sectorNoise) * 0.6, uSectorDarkeningStrength * smoothstep(0.3, 0.8, radialCoord));
  }
  
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
  float proceduralDetail = snoise(coord + vec3(0.0, time * 0.24, -time * 0.08), max(1.0, uCoronaScale1 * 0.7));
  float proceduralDetailAlt = snoise(coord + vec3(0.0, time * 0.36, time * 0.12), max(1.0, uCoronaScale2 * 0.5));

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
  corona *= uCoronaIntensity * (1.15 - drift1 * 0.55) * organicGain * noiseFlicker * sectorModulation;
  float filamentStrength = clamp(uCoronaFilamentStrength, 0.0, 2.5);
  if (filamentStrength > 0.0) {
    float filamentEnvelope = pow(max(fVal1, 0.0), 1.35) * 0.6 + pow(max(fVal2, 0.0), 1.25) * 0.4;
    filamentEnvelope += organicLuma * 0.45 + abs(proceduralDetail) * 0.35;
    corona *= mix(1.0, 0.7 + filamentEnvelope, min(filamentStrength, 1.8));
  }

  float innerRadius = clamp(uCoreRadiusInner, 0.0, 0.95);
  float outerRadius = clamp(uCoreRadiusOuter, innerRadius + 0.05, 1.0);
  float coreBase = 1.0 - smoothstep(innerRadius, outerRadius, radial);
  coreBase = pow(clamp(coreBase, 0.0, 1.0), clamp(uCoreTightness, 0.5, 4.0));
  float detailStrength = clamp(uCoreDetailStrength, 0.0, 2.0);
  float detailNoiseStrength = clamp(uCoreDetailNoise, 0.0, 2.0);
  float coreDetail = 1.0;
  if (detailStrength > 0.0 || detailNoiseStrength > 0.0) {
    float organicDetail = mix(1.0, 0.55 + organicLuma * 1.35, min(detailStrength, 1.2));
    float noiseDetail = mix(1.0, 0.65 + noiseSample.r * 0.9 + abs(proceduralDetail) * 0.7, min(detailNoiseStrength, 1.5));
    float secondaryDetail = mix(1.0, 0.7 + abs(proceduralDetailAlt) * 1.1, min(detailNoiseStrength * 0.8, 1.2));
    coreDetail = organicDetail * mix(1.0, noiseDetail * secondaryDetail, clamp(detailNoiseStrength, 0.0, 1.5));
    coreDetail = mix(1.0, coreDetail, clamp(detailStrength + detailNoiseStrength, 0.0, 1.8));
  }
  // Core-adjacent band that wraps tightly around the hotspot before the rim glow fully takes over.
  float rimCoreBand = smoothstep(innerRadius + 0.02, min(outerRadius + 0.18, 1.0), radial);
  float rimFade = 1.0 - smoothstep(min(outerRadius + 0.18, 1.0), min(outerRadius + 0.32, 1.3), radial);
  float rimBase = max(rimCoreBand * rimFade - coreBase * 0.35, 0.0);
  float core = coreBase * uCoreStrength;
  core *= mix(1.0, coreDetail, clamp(detailStrength + detailNoiseStrength, 0.0, 1.0));
  float rim = rimBase * uRimStrength;

  vec3 color = vec3(0.0);
  vec3 detailTint = mix(uColorCore, mix(organicSample, noiseSample.rgb, 0.35), clamp(detailStrength * 0.75, 0.0, 1.0));
  vec3 coreBlend = mix(detailTint, vec3(1.0), clamp(uCoreHotspotMix, 0.0, 1.0));
  vec3 rimBlend = mix(uColorPrimary, uColorCore, 0.2);
  color += coreBlend * (core * (0.92 + uBrightness * 0.45));
  color += organicSample * (core * 0.18 * textureWeight * clamp(detailStrength, 0.0, 1.2));
  color += rimBlend * (rim * (0.58 + uBrightness * 0.52));
  vec3 coronaColor = mix(uColorPrimary, uColorSecondary, clamp(uCoronaColorBlend, 0.0, 1.0));
  coronaColor = mix(coronaColor, normalize(coronaColor) * length(coronaColor), clamp(filamentStrength * 0.25, 0.0, 0.4));
  float coronaScaled = corona * uCoronaStrength;
  color += coronaColor * coronaScaled * 0.026;
  vec3 organicTint = mix(vec3(1.0), organicSample, 0.55 * textureWeight);
  vec3 noiseTint = mix(vec3(1.0), noiseSample.rgb, 0.25 * textureWeight);
  color = mix(color, color * organicTint, 0.42 * textureWeight);
  color += organicSample * (rim * 0.38 * textureWeight);
  color += noiseSample.rgb * (rim * 0.22 * textureWeight);

  float outerGlowBoost = 1.0 + max(0.0, 1.0 - clamp(uCoronaEdgeSoftness, 0.2, 3.0)) * 0.5;
  float haloExponent = clamp(uHaloFalloff, 0.2, 4.0);
  float outerGlow = pow(max(1.0 - dist, 0.0), haloExponent) * (0.58 + uBrightness * 0.45) * uOuterGlowStrength * outerGlowBoost;
  color += uColorSecondary * outerGlow * 0.58;

  float midBand = clamp(1.0 - abs(radial - 0.55) * 1.8, 0.0, 1.0);
  // Outer band used for softer fill contributions further from the core highlight.
  float rimFillBand = clamp(1.0 - abs(radial - 0.88) * 6.0, 0.0, 1.0);
  float baseFill = pow(midBand, 2.0) + rimFillBand * 0.35;
  baseFill *= mix(1.0, 0.85 + organicLuma * 0.5, clamp(detailStrength * 0.4, 0.0, 0.6));
  vec3 fillTint = mix(uColorCore, uColorSecondary, 0.45);
  float clampedBaseFillStrength = clamp(uBaseFillStrength, 0.0, 1.0);
  color += fillTint * baseFill * clampedBaseFillStrength;
  color += uColorSecondary * rimFillBand * clampedBaseFillStrength * 0.22;

  color *= noiseTint;
  color = clamp(color, 0.0, 1.0);

  float alphaCore = pow(max(1.0 - radial, 0.0), uCoronaFalloff);
  float alpha = alphaCore * mix(0.82, 1.16, clamp(1.0 - uCoronaEdgeSoftness, 0.0, 1.0));
  alpha += coronaScaled * 0.014;
  alpha += baseFill * clampedBaseFillStrength * 0.2;
  alpha += rimFillBand * clampedBaseFillStrength * 0.12;
  alpha += outerGlow * 0.06;
  alpha = clamp(alpha * uOpacity * (0.66 + uBrightness * 0.32) * organicGain * uAlphaStrength, 0.0, 1.0);

  if (alpha <= 0.002) {
    discard;
  }

  gl_FragColor = vec4(color, alpha);
}
