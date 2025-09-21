import React, { useEffect, useMemo, useRef } from 'react';
import { Color, ShaderMaterial, Vector3 } from 'three';
import { useFrame } from '@react-three/fiber';
import { MeshTransmissionMaterial } from '@react-three/drei';
import type { ShieldRipple, ShipHull, Team } from '../types/index.js';
import { getShieldVisuals } from '../config/renderer.js';

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
  const mat = useMemo(() => {
    const { hexScale, edgeWidth, maxAlpha } = getShieldVisuals(hull);
    return new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uTint: { value: new Color(team === 'blue' ? '#66ccff' : '#ff6699') },
        uOpacity: { value: 1 },
        uHexScale: { value: hexScale },
        uEdgeWidth: { value: edgeWidth },
        uMaxAlpha: { value: maxAlpha },
        uRippleDir: { value: new Vector3(0, 0, 1) },
        uRippleT0: { value: -999 },
        uRippleAmp: { value: 0 },
        uRippleSpeed: { value: 2.5 },
        uRippleWidth: { value: 0.2 },
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
          float ring = 0.0;
          if(t > 0.0){
            float d = acos(clamp(dot(N, normalize(uRippleDir)), -1.0, 1.0));
            float r = t * uRippleSpeed;
            float w = uRippleWidth;
            float a = uRippleAmp;
            float band = 1.0 - smoothstep(r-w, r, d) + smoothstep(r, r+w, d);
            ring = band * a * exp(-t*1.2);
          }

          float glow = edge * (0.7 + 0.3*hash(floor(uv))) + ring;
          vec3 col = uTint * (0.4 + glow);
          float alpha = min(uMaxAlpha, uOpacity * clamp(0.05 + glow, 0.0, 1.0));
          if(alpha <= 0.01) discard;
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
    (mat.uniforms as any).uTint.value = new Color(team === 'blue' ? '#66ccff' : '#ff6699');
  }, [team, mat]);
  useEffect(() => {
    if (ripple) {
      (mat.uniforms as any).uRippleDir.value.copy(ripple.dir);
      (mat.uniforms as any).uRippleT0.value = ripple.t0;
      (mat.uniforms as any).uRippleAmp.value = ripple.amp * 1.3;
    } else {
      (mat.uniforms as any).uRippleAmp.value = 0.0;
      (mat.uniforms as any).uRippleT0.value = -999.0;
    }
  }, [ripple, mat]);

  return <primitive object={mat} attach="material" />;
};

// Built-in Shield Transmission material (drei)
const ShieldTransmissionMaterial: React.FC<ShieldMaterialProps> = ({ hull, team, opacity }) => {
  const cfg = getShieldVisuals(hull);
  const tint = useMemo(() => new Color(team === 'blue' ? '#66ccff' : '#ff6699'), [team]);
  const alpha = Math.max(0, Math.min(cfg.maxAlpha, opacity));
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

// Explosions — placeholder smoke-ish material (to be used by explosion meshes when implemented)
const ExplosionSmokeMaterial: React.FC = () => (
  <meshStandardMaterial color="#55585c" roughness={0.9} metalness={0} />
);
registerMaterial('explosion:smoke', ExplosionSmokeMaterial);

export type { ShieldMaterialProps };
export { ShieldHexMaterial, ShieldTransmissionMaterial };
