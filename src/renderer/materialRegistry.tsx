import React, { useEffect, useMemo, useRef } from 'react';
import { Color, ShaderMaterial, Vector3 } from 'three';
import { useFrame } from '@react-three/fiber';
import { MeshTransmissionMaterial } from '@react-three/drei';
import type { ShieldRipple, ShipHull, Team } from '../types/index.js';
import { getShieldVisuals, SHIELD_TUNING, TEAM_COLORS } from '../config/renderer.js';

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
        uRippleDir: { value: new Vector3(0, 0, 1) },
        uRippleT0: { value: -999 },
        uRippleAmp: { value: 0 },
        uRippleSpeed: { value: 3.1 },
        uRippleWidth: { value: 0.16 },
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
        uniform vec3 uRippleDir;
        uniform float uRippleT0;
        uniform float uRippleAmp;
        uniform float uRippleSpeed;
        uniform float uRippleWidth;

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

          float t = uTime - uRippleT0;
          float ripple = 0.0;
          if(t > 0.0){
            vec3 dir = normalize(uRippleDir);
            float ang = acos(clamp(dot(N, dir), -1.0, 1.0));
            float radius = t * uRippleSpeed;
            float width = max(uRippleWidth, 0.05);
            float norm = (ang - radius) / width;
            float gaussian = exp(-norm * norm * 3.5);
            float ramp = smoothstep(0.0, 0.16, t);
            ripple = gaussian * ramp * uRippleAmp * exp(-t * 0.65);
          }

          float sparkle = hash(floor(uv));
          float edgeGlow = edge * (0.7 + 0.3 * sparkle);
          float rippleGlow = ripple * (1.3 + 0.4 * edge);
          vec3 rippleTint = mix(vec3(1.0), uTint, 0.35);

          vec3 base = uTint * (0.4 + edgeGlow);
          vec3 baseCol = clamp(base, 0.0, 1.0);
          if(uTeamIsRed > 0.5 && uEnableRedBoost > 0.5) {
            baseCol = clamp(pow(baseCol, vec3(uRedBoostPow)) * uRedBoostMul, 0.0, 1.0);
          }

          vec3 col = clamp(baseCol + rippleTint * rippleGlow, 0.0, 1.0);
          float alpha = clamp(uOpacity * uMaxAlpha * clamp(0.08 + edgeGlow + ripple * 0.7, 0.0, 1.0), 0.0, 1.0);
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
    if (ripple) {
      const amp = Math.min(1.6, 0.25 + ripple.amp * 1.9);
      uniforms.uRippleDir.value.copy(ripple.dir);
      uniforms.uRippleT0.value = ripple.t0;
      uniforms.uRippleAmp.value = amp;
      uniforms.uRippleSpeed.value = 3.1;
      uniforms.uRippleWidth.value = 0.14 + (1 - ripple.amp) * 0.06;
    } else {
      uniforms.uRippleAmp.value = 0.0;
      uniforms.uRippleT0.value = -999.0;
      uniforms.uRippleWidth.value = 0.16;
    }
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
