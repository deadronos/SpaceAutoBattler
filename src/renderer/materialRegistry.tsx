import React, { useEffect, useMemo, useRef } from 'react';
import { Color, ShaderMaterial, Vector3, Vector4 } from 'three';
import { useFrame } from '@react-three/fiber';
import { MeshTransmissionMaterial } from '@react-three/drei';
import type { ShieldRipple, ShipHull, Team } from '../types/index.js';
import { getShieldVisuals, SHIELD_TUNING, TEAM_COLORS, SHIELD_RIPPLE_TUNING } from '../config/renderer.js';
import { colorFromConfig } from '../utils/color.js';

// Maximum ripples the shader supports (compile-time constant mirrored in GLSL)
const SHADER_MAX_RIPPLES = 8;

export type MaterialKey = string; // e.g., 'shield:hex', 'shield:transmission'

type ShieldMaterialProps = {
  hull: ShipHull;
  team: Team;
  opacity: number; // 0..1, will be clamped by material
  ripple?: ShieldRipple;
  simTime?: number; // GameState.time for aligning ripple t0 to local uTime
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
const ShieldHexMaterial: React.FC<ShieldMaterialProps> = ({ hull, team, opacity, ripple, simTime }) => {
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
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        // Store uniform tint in linear space for shader math consistency
        uTint: { value: colorFromConfig(team === 'blue' ? TEAM_COLORS.blue : SHIELD_TUNING.redTint) },
        uTeamIsRed: { value: team === 'red' ? 1.0 : 0.0 },
        uEnableRedBoost: { value: SHIELD_TUNING.enableRedBoost ? 1.0 : 0.0 },
        uRedBoostPow: { value: SHIELD_TUNING.redBoostPower },
        uRedBoostMul: { value: SHIELD_TUNING.redBoostMultiplier },
        uEdgeAlphaMul: { value: SHIELD_TUNING.edgeAlphaMul },
        uFillAlphaMul: { value: SHIELD_TUNING.fillAlphaMul },
        uMinAlphaFloor: { value: SHIELD_TUNING.minAlphaFloor },
        uFillTintMul: { value: SHIELD_TUNING.fillTintMul },
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
        uniform float uEdgeAlphaMul;
        uniform float uFillAlphaMul;
        uniform float uMinAlphaFloor;
        uniform float uFillTintMul;
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

        // Signed distance to a regular hexagon (flat-top) of radius r
        float sdHexagon(vec2 p, float r) {
          const vec3 k = vec3(-0.8660254, 0.5, 0.5773503);
          p = abs(p);
          p -= 2.0 * min(dot(k.xy, p), 0.0) * k.xy;
          p -= vec2(clamp(p.x, -k.z * r, k.z * r), r);
          return length(p) * sign(p.y);
        }
        // Convert from Cartesian to skewed hex grid coordinates (axial projection helper)
        vec2 hexSkew(vec2 p) {
          // Based on Red Blob Games axial coords (flat-top hexes)
          // q = 2/3 x
          // r = -1/3 x + sqrt(3)/3 y
          return vec2((2.0/3.0) * p.x, (-1.0/3.0) * p.x + (0.57735026919) * p.y);
        }
        // Convert axial (q,r) back to Cartesian center position
        vec2 hexUnskew(vec2 h) {
          // x = 3/2 q
          // y = sqrt(3)/2 q + sqrt(3) r
          return vec2(1.5 * h.x, 0.86602540378 * h.x + 1.73205080757 * h.y);
        }
        // Find local coordinates within nearest hex cell (centered at origin)
        vec2 hexLocal(vec2 p) {
          vec2 a = hexSkew(p);
          // cube rounding
          vec3 c = vec3(a.x, -a.x - a.y, a.y);
          vec3 rc = floor(c + 0.5);
          vec3 diff = abs(rc - c);
          if (diff.x > diff.y && diff.x > diff.z) rc.x = -rc.y - rc.z;
          else if (diff.y > diff.z) rc.y = -rc.x - rc.z;
          else rc.z = -rc.x - rc.y;
          vec2 centerAxial = vec2(rc.x, rc.z);
          vec2 center = hexUnskew(centerAxial);
          return p - center;
        }

        void main(){
          vec3 N = normalize(vWorldPos - vCenter);
          vec2 uv = vec2(atan(N.z, N.x)/6.2831853 + 0.5, acos(N.y)/3.1415926);
          uv *= uHexScale;
          // Build a true hex tiling on the plane defined by uv
          vec2 cell = hexLocal(uv);
          float d = sdHexagon(cell, 0.5);
          // Border mask near hex edges (1 at edge, 0 away from edge)
          float w = max(0.0001, uEdgeWidth);
          float border = 1.0 - smoothstep(0.0, w, abs(d));

          float ripple = 0.0;
          // Accumulate ripples from packed arrays; respect uRippleCount to avoid extra work
          for (int i = 0; i < SHADER_MAX_RIPPLES; i++) {
            if (i >= uRippleCount) break;
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
          float edgeGlow = border * (0.7 + 0.3 * sparkle);
          // Apply color multiplier and strength (slightly bias ripple to show near edges)
          float rippleGlow = ripple * (1.0 + 0.5 * border) * uRippleColorMul;
          vec3 rippleTint = mix(vec3(1.0), uTint, 0.35) * uRippleColorMul;

          // Base color: add subtle interior tint so fill isn't pitch black
          float fill = clamp(1.0 - border, 0.0, 1.0);
          vec3 base = uTint * (0.9 * edgeGlow + uFillTintMul * fill);
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

          // Alpha: edge-dominant base plus a subtle interior fill so it isn't too transparent
          float alphaBase = uOpacity * uMaxAlpha * (edgeGlow * uEdgeAlphaMul + fill * uFillAlphaMul);
          // Ensure a minimal visibility floor
          alphaBase = max(alphaBase, uOpacity * uMaxAlpha * uMinAlphaFloor);
          float rippleContribution = clamp(ripple * (0.5 + 0.5 * border) * uRippleStrength, 0.0, 1.0);
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


  // Tick time for shader animations
  useFrame((_, dt) => {
    (mat.uniforms as any).uTime.value += dt;
  });

  // Update props-driven uniforms (non-ripple scheduling settings)
  useEffect(() => {
    (mat.uniforms as any).uOpacity.value = Math.max(0, Math.min(1, opacity));
  }, [opacity, mat]);
  useEffect(() => {
    // Copy a linearised tint into the uniform to avoid mutating caller-provided Color
    (mat.uniforms as any).uTint.value.copy(colorFromConfig(team === 'blue' ? TEAM_COLORS.blue : SHIELD_TUNING.redTint));
    (mat.uniforms as any).uTeamIsRed.value = team === 'red' ? 1.0 : 0.0;
    (mat.uniforms as any).uEnableRedBoost.value = SHIELD_TUNING.enableRedBoost ? 1.0 : 0.0;
    (mat.uniforms as any).uRedBoostPow.value = SHIELD_TUNING.redBoostPower;
    (mat.uniforms as any).uRedBoostMul.value = SHIELD_TUNING.redBoostMultiplier;
  }, [team, mat]);
  useEffect(() => {
    const uniforms = mat.uniforms as any;
    const maxRipples = Math.min(SHIELD_RIPPLE_TUNING.maxRipples ?? 3, SHADER_MAX_RIPPLES);
    // Prepare default
    uniforms.uRippleData.value = uniforms.uRippleData.value ?? Array.from({ length: SHADER_MAX_RIPPLES }, () => new Vector4(0, 0, 1, 0));
    uniforms.uRippleT0s.value = uniforms.uRippleT0s.value ?? new Array<number>(SHADER_MAX_RIPPLES).fill(-999);
    for (let i = 0; i < SHADER_MAX_RIPPLES; i++) {
      const v = uniforms.uRippleData.value[i] as Vector4;
      v.set(0, 0, 1, 0);
      uniforms.uRippleT0s.value[i] = -999;
    }
    uniforms.uRippleCount.value = 0;

    const list: ShieldRipple[] = ripple ? (Array.isArray(ripple) ? ripple : [ripple]) : [];
    const bias = ((uniforms.uTime?.value as number) ?? 0) - (simTime ?? 0);
    const take = Math.min(list.length, maxRipples);
    for (let i = 0; i < take; i++) {
      const r = list[list.length - take + i];
      const amp = Math.min(1.6, 0.25 + (r.amp ?? 0) * (SHIELD_RIPPLE_TUNING.ampScale ?? 1.9));
      const dir = r.dir ?? new Vector3(0, 0, 1);
      (uniforms.uRippleData.value[i] as Vector4).set(dir.x, dir.y, dir.z, amp);
      uniforms.uRippleT0s.value[i] = bias + (r.t0 ?? 0);
    }
    uniforms.uRippleCount.value = take;
    uniforms.uRippleSpeed.value = SHIELD_RIPPLE_TUNING.defaultSpeed;
    uniforms.uRippleWidthBase.value = SHIELD_RIPPLE_TUNING.baseWidth;
    uniforms.uRippleBlendMode.value = SHIELD_RIPPLE_TUNING.blendMode;
    uniforms.uRippleIgnoreMaxAlpha.value = SHIELD_RIPPLE_TUNING.ignoreMaxAlpha ? 1.0 : 0.0;
    uniforms.uRippleColorMul.value = SHIELD_RIPPLE_TUNING.colorMul;
    uniforms.uRippleStrength.value = SHIELD_RIPPLE_TUNING.strength;
    // No debug overlay: normal runtime behavior only
  }, [ripple, simTime, mat]);

  return <primitive object={mat} attach="material" />;
};

// Built-in Shield Transmission material (drei)
const ShieldTransmissionMaterial: React.FC<ShieldMaterialProps> = ({ hull, team, opacity }) => {
  const cfg = getShieldVisuals(hull);
  const tint = useMemo(() => colorFromConfig(team === 'blue' ? TEAM_COLORS.blue : SHIELD_TUNING.redTint), [team]);
  // Scale opacity by configured maxAlpha so material alpha is proportional to shield fraction
  const alpha = Math.max(0, Math.min(1, opacity * cfg.maxAlpha));
  return (
    <MeshTransmissionMaterial
      transparent
      depthWrite={false}
      color={tint}
      resolution={256}
      attenuationColor={tint}
      thickness={cfg.meshtransmission.thickness}
      chromaticAberration={cfg.meshtransmission.chromaticAberration}
      anisotropicBlur={cfg.meshtransmission.anisotropicBlur}
      distortion={cfg.meshtransmission.distortion}
      distortionScale={cfg.meshtransmission.distortionScale}
      temporalDistortion={cfg.meshtransmission.temporalDistortion}
      attenuationDistance={cfg.meshtransmission.attenuationDistance}
      roughness={cfg.meshtransmission.roughness}
      clearcoat={cfg.meshtransmission.clearcoat}
      ior={cfg.meshtransmission.ior}
      opacity={alpha}
    />
  );
};

// Register built-ins
registerMaterial('shield:hex', ShieldHexMaterial);
registerMaterial('shield:meshtransmission', ShieldTransmissionMaterial);

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
