import React, { useEffect, useMemo, useRef } from 'react';
import { Color, ShaderMaterial, Vector3, Vector4 } from 'three';
import { useFrame } from '@react-three/fiber';
import { MeshTransmissionMaterial } from '@react-three/drei';
import type { ShieldRipple, ShipHull, Team } from '../types/index.js';
import { getShieldVisuals, SHIELD_TUNING, TEAM_COLORS, SHIELD_RIPPLE_TUNING } from '../config/renderer.js';

// Maximum ripples the shader supports (compile-time constant mirrored in GLSL)
const SHADER_MAX_RIPPLES = 8;

export type MaterialKey = string; // e.g., 'shield:hex', 'shield:transmission'

type ShieldMaterialProps = {
  hull: ShipHull;
  team: Team;
  opacity: number; // 0..1, will be clamped by material
  ripple?: ShieldRipple;
};

type MaterialComponent<P = any> = React.FC<P>;

const registry = new Map<MaterialKey, MaterialComponent<any>>();

export function registerMaterial<P>(key: MaterialKey, comp: MaterialComponent<P>): void {
  registry.set(key, comp as MaterialComponent<any>);
}

export function getMaterial<P = any>(key: MaterialKey): MaterialComponent<P> | undefined {
  return registry.get(key) as MaterialComponent<P> | undefined;
}

// Built-in Shield Hex material (custom shader)
const ShieldHexMaterial: React.FC<ShieldMaterialProps> = ({ hull, team, opacity, ripple }) => {
  // Alpha computation note:
  // - The renderer computes `opacity` as the shield fraction: shield / maxShield (clamped 0..1)
  // - The shader multiplies that `uOpacity` by a glow-driven factor (0.05 + glow) which
  //   encodes hex-edge glow + transient ripple rings. That product is then clamped by
  //   `uMaxAlpha` (configured per-hull via getShieldVisuals) so visual opacity never
  //   exceeds a hull-specific maximum. Finally, tiny final-alpha values are discarded
  //   by the `if(alpha <= 0.01) discard;` branch to avoid rendering very faint fragments.
  // Rationale: this produces a shield whose overall visibility scales with remaining
  // HP, whose local brightness comes from hex/ripple glow, and which is bounded for
  // consistent visuals across hull sizes.
  const mat = useMemo(() => {
    const { hexScale, edgeWidth, maxAlpha } = getShieldVisuals(hull);
  return new ShaderMaterial({
      transparent: true,
      depthWrite: true,
      uniforms: {
        uTime: { value: 0 },
  uTint: { value: new Color(team === 'blue' ? TEAM_COLORS.blue : SHIELD_TUNING.redTint) },
        uTeamIsRed: { value: team === 'red' ? 1.0 : 0.0 },
        uEnableRedBoost: { value: SHIELD_TUNING.enableRedBoost ? 1.0 : 0.0 },
        uRedBoostPow: { value: SHIELD_TUNING.redBoostPower },
        uRedBoostMul: { value: SHIELD_TUNING.redBoostMultiplier },
        uOpacity: { value: 1 },
        uHexScale: { value: hexScale },
        uEdgeWidth: { value: edgeWidth },
        uMaxAlpha: { value: maxAlpha },
  // Pack ripple per-entry data into vec4 arrays for efficiency: (dir.xyz, amp)
  uRippleCount: { value: 0 },
  uRippleData: { value: Array.from({ length: SHADER_MAX_RIPPLES }, () => new Vector4(0, 0, 1, 0)) },
  uRippleT0s: { value: new Array<number>(SHADER_MAX_RIPPLES).fill(-999) as number[] },
        uRippleSpeed: { value: SHIELD_RIPPLE_TUNING.defaultSpeed },
        uRippleWidthBase: { value: SHIELD_RIPPLE_TUNING.baseWidth },
        uRippleBlendMode: { value: SHIELD_RIPPLE_TUNING.blendMode },
        uRippleIgnoreMaxAlpha: { value: SHIELD_RIPPLE_TUNING.ignoreMaxAlpha ? 1.0 : 0.0 },
        uRippleColorMul: { value: SHIELD_RIPPLE_TUNING.colorMul },
        uRippleStrength: { value: SHIELD_RIPPLE_TUNING.strength },
      },
      vertexShader: `
        varying vec3 vWorldPos;
        varying vec3 vCenter;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          vCenter = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        varying vec3 vWorldPos;
        varying vec3 vCenter;
        uniform float uTime;
        uniform vec3 uTint;
        uniform float uOpacity;
        uniform float uHexScale;
        uniform float uEdgeWidth;
        uniform float uMaxAlpha;
  uniform float uTeamIsRed;
  uniform float uEnableRedBoost;
  uniform float uRedBoostPow;
  uniform float uRedBoostMul;
  uniform int uRippleCount;
  uniform float uRippleSpeed;
  uniform float uRippleWidthBase;
  // Packed ripple arrays
  const int SHADER_MAX_RIPPLES = ${SHADER_MAX_RIPPLES};
  uniform vec4 uRippleData[SHADER_MAX_RIPPLES];
  uniform float uRippleT0s[SHADER_MAX_RIPPLES];
  uniform float uRippleBlendMode;
  uniform float uRippleIgnoreMaxAlpha;
  uniform float uRippleColorMul;
  uniform float uRippleStrength;

        float hash(vec2 p){return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453);}

        vec2 hex(vec2 p){
          const vec2 k = vec2(0.8660254, 0.5);
          p = abs(p);
          p -= 2.0*min(dot(k,p),0.0)*k;
          p -= vec2(clamp(p.x, -k.y, k.y), 1.0);
          return p;
        }

        void main(){
          vec3 N = normalize(vWorldPos - vCenter);
          vec2 uv = vec2(atan(N.z, N.x)/6.2831853 + 0.5, acos(N.y)/3.1415926);
          uv *= uHexScale;
          vec2 h = hex(fract(uv)-0.5);
          float edge = smoothstep(uEdgeWidth, 0.0, max(h.x, h.y));

          float ripple = 0.0;
          // Accumulate ripples from packed arrays. Shader supports up to SHADER_MAX_RIPPLES entries.
          for (int i = 0; i < SHADER_MAX_RIPPLES; i++) {
            float t = uTime - uRippleT0s[i];
            vec3 dir = normalize(uRippleData[i].xyz);
            float amp = uRippleData[i].w;
            if (t > 0.0 && amp > 0.0) {
              float ang = acos(clamp(dot(N, dir), -1.0, 1.0));
              float radius = t * uRippleSpeed;
              float width = max(uRippleWidthBase, 0.05);
              float norm = (ang - radius) / width;
              float gaussian = exp(-norm * norm * 3.5);
              float ramp = smoothstep(0.0, 0.16, t);
              ripple += gaussian * ramp * amp * exp(-t * 0.65);
            }
          }

          float sparkle = hash(floor(uv));
          float edgeGlow = edge * (0.7 + 0.3 * sparkle);
          // Apply color multiplier and strength
          float rippleGlow = ripple * (1.3 + 0.4 * edge) * uRippleColorMul;
          vec3 rippleTint = mix(vec3(1.0), uTint, 0.35) * uRippleColorMul;

          vec3 base = uTint * (0.4 + edgeGlow);
          vec3 baseCol = clamp(base, 0.0, 1.0);
          if(uTeamIsRed > 0.5 && uEnableRedBoost > 0.5) {
            baseCol = clamp(pow(baseCol, vec3(uRedBoostPow)) * uRedBoostMul, 0.0, 1.0);
          }

          // Combine base color and ripple contribution according to blend mode
          vec3 col;
          if(uRippleBlendMode < 0.5) {
            // Additive: just add ripple tint*glow and clamp
            col = clamp(baseCol + rippleTint * rippleGlow, 0.0, 1.0);
          } else {
            // Perceptual soft clamp: add then apply soft saturation
            vec3 added = baseCol + rippleTint * rippleGlow;
            col = added / (1.0 + added); // simple soft-saturate (x/(1+x)) keeps values in 0..1
          }

          // Alpha: base bubble always respects uMaxAlpha. Ripples add a contribution
          // which may optionally ignore uMaxAlpha when configured.
          float rippleAlphaFactor = clamp(0.08 + edgeGlow + ripple * 0.7 * uRippleStrength, 0.0, 1.0);
          float alphaBase = uOpacity * uMaxAlpha; // base shield respects hull max
          float rippleContribution = rippleAlphaFactor * uRippleStrength;
          float alpha;
          if(uRippleIgnoreMaxAlpha > 0.5) {
            // Ripple can push alpha up toward full brightness (1.0), added on top of base
            alpha = clamp(alphaBase + rippleContribution, 0.0, 1.0);
          } else {
            // Ripple contribution is limited by hull maxAlpha so bubble overall stays within per-hull cap
            alpha = clamp(alphaBase + rippleContribution * uMaxAlpha, 0.0, 1.0);
          }
          if(alpha <= 0.002) discard;
          gl_FragColor = vec4(col, alpha);
        }
      `,
    });
  }, [hull, team]);


  // Tick time
  useFrame((_, dt) => {
    (mat.uniforms as any).uTime.value += dt;
  });

  // Update props-driven uniforms
  useEffect(() => {
    (mat.uniforms as any).uOpacity.value = Math.max(0, Math.min(1, opacity));
  }, [opacity, mat]);
  useEffect(() => {
  (mat.uniforms as any).uTint.value = new Color(team === 'blue' ? TEAM_COLORS.blue : SHIELD_TUNING.redTint);
    (mat.uniforms as any).uTeamIsRed.value = team === 'red' ? 1.0 : 0.0;
    (mat.uniforms as any).uEnableRedBoost.value = SHIELD_TUNING.enableRedBoost ? 1.0 : 0.0;
    (mat.uniforms as any).uRedBoostPow.value = SHIELD_TUNING.redBoostPower;
    (mat.uniforms as any).uRedBoostMul.value = SHIELD_TUNING.redBoostMultiplier;
  }, [team, mat]);
  useEffect(() => {
    const uniforms = mat.uniforms as any;
    // Prepare default (no ripples)
    const maxRipples = Math.min(SHIELD_RIPPLE_TUNING.maxRipples ?? 3, SHADER_MAX_RIPPLES);
    // Ensure underlying arrays exist
    uniforms.uRippleData.value = uniforms.uRippleData.value ?? Array.from({ length: SHADER_MAX_RIPPLES }, () => new Vector4(0, 0, 1, 0));
    uniforms.uRippleT0s.value = uniforms.uRippleT0s.value ?? new Array<number>(SHADER_MAX_RIPPLES).fill(-999);
    // Zero out all entries first
    for (let i = 0; i < SHADER_MAX_RIPPLES; i++) {
      const v = uniforms.uRippleData.value[i] as Vector4;
      v.set(0, 0, 1, 0);
      uniforms.uRippleT0s.value[i] = -999;
    }
    uniforms.uRippleCount.value = 0;

    // If the prop is a single ripple, wrap it; but we expect upstream to pass an array of ripples
    const rippleList = ripple ? (Array.isArray(ripple) ? ripple : [ripple]) : [];
    const startTime = (uniforms.uTime && typeof uniforms.uTime.value === 'number')
      ? uniforms.uTime.value
      : null;
    // Fill up to maxRipples with the latest entries
    for (let i = 0; i < Math.min(rippleList.length, maxRipples); i++) {
      const r = rippleList[rippleList.length - Math.min(rippleList.length, maxRipples) + i];
      const amp = Math.min(1.6, 0.25 + (r.amp ?? 0) * (SHIELD_RIPPLE_TUNING.ampScale ?? 1.9));
      const idx = i; // place 0..maxRipples-1 in array
      const dir = r.dir ?? new Vector3(0, 0, 1);
      uniforms.uRippleData.value[idx].set(dir.x, dir.y, dir.z, amp);
      uniforms.uRippleT0s.value[idx] = startTime ?? r.t0;
    }
    uniforms.uRippleCount.value = Math.min(rippleList.length, maxRipples);
    // Ensure base values are set
    uniforms.uRippleSpeed.value = SHIELD_RIPPLE_TUNING.defaultSpeed;
    uniforms.uRippleWidthBase.value = SHIELD_RIPPLE_TUNING.baseWidth;
  }, [ripple, mat]);

  return <primitive object={mat} attach="material" />;
};

// Built-in Shield Transmission material (drei)
const ShieldTransmissionMaterial: React.FC<ShieldMaterialProps> = ({ hull, team, opacity }) => {
  const cfg = getShieldVisuals(hull);
  const tint = useMemo(() => new Color(team === 'blue' ? TEAM_COLORS.blue : SHIELD_TUNING.redTint), [team]);
  // Scale opacity by configured maxAlpha so material alpha is proportional to shield fraction
  const alpha = Math.max(0, Math.min(1, opacity * cfg.maxAlpha));
  return (
    <MeshTransmissionMaterial
      transparent
      depthWrite={false}
      color={tint}
      attenuationColor={tint}
      thickness={cfg.transmission.thickness}
      chromaticAberration={cfg.transmission.chromaticAberration}
      anisotropicBlur={cfg.transmission.anisotropicBlur}
      distortion={cfg.transmission.distortion}
      distortionScale={cfg.transmission.distortionScale}
      temporalDistortion={cfg.transmission.temporalDistortion}
      attenuationDistance={cfg.transmission.attenuationDistance}
      roughness={cfg.transmission.roughness}
      clearcoat={cfg.transmission.clearcoat}
      ior={cfg.transmission.ior}
      opacity={alpha}
    />
  );
};

// Register built-ins
registerMaterial('shield:hex', ShieldHexMaterial);
registerMaterial('shield:transmission', ShieldTransmissionMaterial);

// Bullets — simple emissive glow material (laser-like)
const BulletLaserMaterial: React.FC = () => (
  <meshStandardMaterial color="#ffd089" emissive="#ff962f" emissiveIntensity={1.8} />
);
registerMaterial('bullet:laser', BulletLaserMaterial);

// Additional bullet materials
const BulletPlasmaMaterial: React.FC = () => (
  <meshStandardMaterial color="#c78bff" emissive="#a04bff" emissiveIntensity={2.2} roughness={0.2} metalness={0.1} />
);
registerMaterial('bullet:plasma', BulletPlasmaMaterial);

const BulletIonMaterial: React.FC = () => (
  <meshStandardMaterial color="#bfe9ff" emissive="#6fe8ff" emissiveIntensity={3.0} roughness={0.05} metalness={0.0} />
);
registerMaterial('bullet:ion', BulletIonMaterial);

const BulletHeavyMaterial: React.FC = () => (
  <meshStandardMaterial color="#ffd6b3" emissive="#ffb36b" emissiveIntensity={1.2} roughness={0.6} metalness={0.2} />
);
registerMaterial('bullet:heavy', BulletHeavyMaterial);

// Explosions — placeholder smoke-ish material (to be used by explosion meshes when implemented)
const ExplosionSmokeMaterial: React.FC = () => (
  <meshStandardMaterial color="#55585c" roughness={0.9} metalness={0} />
);
registerMaterial('explosion:smoke', ExplosionSmokeMaterial);

export type { ShieldMaterialProps };
export { ShieldHexMaterial, ShieldTransmissionMaterial };
