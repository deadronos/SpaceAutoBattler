import {
  AdditiveBlending,
  DoubleSide,
  MeshBasicMaterial,
  NormalBlending,
  ShaderMaterial,
} from 'three';
import { colorFromConfig } from '../../utils/color.js';
import { reportMaterialError } from '../../utils/errorReporting.js';
import type { MaterialWithUserData } from '../../types/renderer.js';

export interface PlanetRingMaterialOptions {
  color: string;
  opacity: number;
  innerRadius: number;
  outerRadius: number;
  brightness: number;
  fresnelStrength: number;
  tintColor?: string;
  tintMix?: number;
  bloomOnly: boolean;
  bandFrequency: number;
  bandStrength: number;
  bandNoiseScale: number;
  bandDarkness: number;
  planetCenter: { x: number; y: number; z: number };
  planetRadius: number;
  shadowStrength: number;
  penumbra: number;
  lightDir: { x: number; y: number; z: number };
}

/**
 * Builds the shader material for planet rings.
 *
 * @param {PlanetRingMaterialOptions} opts - Ring appearance/lighting options.
 * @returns {ShaderMaterial}
 */
export function createPlanetRingMaterial(opts: PlanetRingMaterialOptions): ShaderMaterial {
  const {
    color,
    opacity,
    innerRadius,
    outerRadius,
    brightness,
    fresnelStrength,
    tintColor,
    tintMix,
    bloomOnly,
    bandFrequency,
    bandStrength,
    bandNoiseScale,
    bandDarkness,
    planetCenter,
    planetRadius,
    shadowStrength,
    penumbra,
    lightDir,
  } = opts;

  const mat = new ShaderMaterial({
    uniforms: {
      uColor: { value: colorFromConfig(color) },
      uOpacity: { value: opacity },
      uInnerRadius: { value: innerRadius },
      uOuterRadius: { value: outerRadius },
      // Fresnel-like highlight strength (view-dependent)
      uFresnelStrength: { value: fresnelStrength },
      // Brightness multiplier for base color
      uBrightness: { value: brightness },
      // Optional tint to ensure visibility when postprocessing is off
      uTintColor: { value: colorFromConfig(tintColor ?? '#d9efff') },
      uTintMix: { value: typeof tintMix === 'number' ? tintMix : 0.0 },
      // Banding
      uBandFreq: { value: bandFrequency },
      uBandStrength: { value: bandStrength },
      uBandNoiseScale: { value: bandNoiseScale },
      uBandDarkness: { value: bandDarkness },
      // Planet shadowing (in world-space)
      uPlanetCenter: { value: [planetCenter.x, planetCenter.y, planetCenter.z] },
      uPlanetRadius: { value: planetRadius },
      uShadowStrength: { value: shadowStrength },
      // Penumbra (normalized fraction of planet radius)
      uPenumbra: { value: penumbra },
      // Light direction (world space) — default matches CELESTIAL_ENVIRONMENT but may be overridden by caller
      uLightDir: { value: [lightDir.x, lightDir.y, lightDir.z] },
    },
    vertexShader: `
        varying vec2 vUv;
        varying float vRadius;
        varying vec3 vNormal;
        varying vec3 vPosView;
        varying vec3 vWorldPos;
        uniform float uInnerRadius;
        uniform float uOuterRadius;

        void main() {
          vUv = uv;
          // Compute normalized radius from object-space position instead of UVs.
          float localRadius = length(position.xy);
          vRadius = clamp((localRadius - uInnerRadius) / max((uOuterRadius - uInnerRadius), 1e-6), 0.0, 1.0);

          // Provide transformed normal and view-space position for fresnel calc
          vNormal = normalize(normalMatrix * normal);
          vPosView = (modelViewMatrix * vec4(position, 1.0)).xyz;
          vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;

          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
    fragmentShader: `
        uniform vec3 uColor;
        uniform float uOpacity;
        uniform float uInnerRadius;
        uniform float uOuterRadius;
        uniform float uFresnelStrength;
        uniform float uBrightness;
        uniform vec3 uTintColor;
        uniform float uTintMix;
        uniform float uBandFreq;
        uniform float uBandStrength;
        uniform float uBandNoiseScale;
        uniform float uBandDarkness;
        uniform vec3 uPlanetCenter;
        uniform float uPlanetRadius;
        uniform float uShadowStrength;
        uniform float uPenumbra;
        uniform vec3 uLightDir;

        varying vec2 vUv;
        varying float vRadius;
        varying vec3 vNormal;
        varying vec3 vPosView;
        varying vec3 vWorldPos;

        // Simple hash/noise helper
        float hash(float x) { return fract(sin(x) * 43758.5453123); }

        void main() {
          float normalizedRadius = vRadius;

          // Base alpha shaped as a bell around the middle of the ring
          float alpha = 1.0 - abs(normalizedRadius - 0.5) * 2.0;
          alpha = smoothstep(0.0, 0.4, alpha) * smoothstep(0.6, 1.0, alpha);

          // Banding: procedural narrow bands via a fast sinusoid + positional jitter
          float bandPos = normalizedRadius * uBandFreq;
          float band = sin(bandPos * 6.28318530718);
          // jitter using a cheap hash based on world position for natural irregularity
          float jitter = (hash(vWorldPos.x * 12.9898 + vWorldPos.y * 78.233 + vWorldPos.z * 37.719) - 0.5) * uBandNoiseScale;
          float bandMix = smoothstep(0.1, 0.9, band * 0.5 + 0.5 + jitter * 0.5);
          // darken bands according to strength/darkness
          float bandDarken = mix(1.0, 1.0 - uBandDarkness, bandMix * uBandStrength);

          // Gentle radial texturing
          float ringPattern = sin(normalizedRadius * 80.0) * 0.03 + 0.97;
          alpha *= ringPattern * bandDarken;

          // Edge fade near inner/outer radii
          float edgeFade = smoothstep(0.0, 0.05, normalizedRadius) * smoothstep(0.95, 1.0, normalizedRadius);
          alpha *= edgeFade;

          // Fresnel / view-dependent highlight to simulate icy reflectivity
          vec3 n = normalize(vNormal);
          vec3 viewDir = normalize(-vPosView);
          float fresnel = pow(1.0 - max(0.0, dot(n, viewDir)), 3.0);
          float highlight = fresnel * uFresnelStrength;

          // Apply brightness and mix a small amount of white for specular-ish tint
          vec3 base = uColor * uBrightness;
          vec3 specular = mix(base, vec3(1.0), clamp(highlight * 0.7, 0.0, 1.0));

          // Planet shadow with soft penumbra
          vec3 L = normalize(-uLightDir);
          vec3 toCenter = uPlanetCenter - vWorldPos;
          float t = dot(toCenter, L);
          float inShadow = 0.0;
          float penumbraFactor = 0.0;
          float r2 = uPlanetRadius * uPlanetRadius;
          float d2 = dot(toCenter, toCenter) - t * t;
          if (t > 0.0) {
            if (d2 < r2) {
              inShadow = 1.0;
              penumbraFactor = 1.0;
            } else {
              // outside but may be within penumbra region
              float dist = sqrt(d2);
              float distEdge = dist - uPlanetRadius;
              float penRad = max(uPenumbra * uPlanetRadius, 1e-6);
              penumbraFactor = clamp(1.0 - distEdge / penRad, 0.0, 1.0);
            }
          }

          float shadowFactor = mix(1.0, 1.0 - uShadowStrength, penumbraFactor);

          // Ensure a larger alpha floor so the ring remains visible even
          // when bloom/postprocessing is disabled. Add fresnel contribution
          // to brighten the rim further.
          alpha = max(alpha, 0.03) + highlight * 0.18;

          // Mix in a tint color to push the ring toward blue-white when
          // postprocessing is disabled or artist requested.
          vec3 finalBase = mix(base, uTintColor, clamp(uTintMix, 0.0, 1.0));

          // apply band darkening and planet shadow to final color
          finalBase *= bandDarken * shadowFactor;

          gl_FragColor = vec4(finalBase, alpha * uOpacity);
        }
      `,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: DoubleSide,
    blending: AdditiveBlending,
  });

  try {
    // Ensure this material writes to the main color buffer by default when
    // bloomOnly is not requested. If bloomOnly is true the material will
    // intentionally allow the BloomProvider to toggle colorWrite in order
    // to render the object primarily via bloom.
    mat.colorWrite = true;
    if (!mat.userData) mat.userData = {};
    // forceColorWrite true means "do not let the bloom manager disable
    // colorWrite". We set it to the inverse of bloomOnly so artists can
    // opt-in to bloom-only elements.
    (mat as MaterialWithUserData).userData.__copilot_forceColorWrite = !(bloomOnly === true);
    // Also expose an explicit bloomOnly flag for clarity/debugging.
    (mat as MaterialWithUserData).userData.__copilot_bloomOnly = Boolean(bloomOnly === true);
  } catch (error) {
    // Expected: Material userData may be read-only in some environments
    reportMaterialError('userData', 'ShaderMaterial', error);
  }

  return mat;
}

/**
 * Builds the basic (non-shader) fallback material for planet rings, used when
 * postprocessing is disabled.
 *
 * @param {{ tintColor?: string; opacity: number; bloomOnly: boolean }} opts - Fallback options.
 * @returns {MeshBasicMaterial}
 */
export function createPlanetRingBasicMaterial(opts: {
  tintColor?: string;
  opacity: number;
  bloomOnly: boolean;
}): MeshBasicMaterial {
  const { tintColor, opacity, bloomOnly } = opts;
  const color = colorFromConfig(tintColor ?? '#d9efff');
  const bm = new MeshBasicMaterial({
    color,
    transparent: true,
    opacity: Math.max(0.45, opacity),
    depthTest: true,
    depthWrite: false,
    side: DoubleSide,
    blending: NormalBlending,
  });
  try {
    if (!bm.userData) bm.userData = {};
    // For basic fallback, also respect bloomOnly: if bloomOnly is false
    // we want the material to remain color-write enabled always.
    (bm as MaterialWithUserData).userData.__copilot_forceColorWrite = !(bloomOnly === true);
    (bm as MaterialWithUserData).userData.__copilot_bloomOnly = Boolean(bloomOnly === true);
  } catch (error) {
    // Expected: Material userData may be read-only in some environments
    reportMaterialError('userData', 'MeshBasicMaterial', error);
  }
  return bm;
}
