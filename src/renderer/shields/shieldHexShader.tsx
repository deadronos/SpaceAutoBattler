import React, { useEffect, useMemo } from 'react';
import { ShaderMaterial, Vector3, Vector4 } from 'three';
import { useFrame } from '@react-three/fiber';
import type { ShieldRipple, ShipHull, Team } from '../../types/index.js';
import { getShieldVisuals, SHIELD_TUNING, TEAM_COLORS, SHIELD_RIPPLE_TUNING } from '../../config/renderer.js';
import { colorFromConfig } from '../../utils/color.js';

const SHADER_MAX_RIPPLES = 8;

export type ShieldHexMaterialProps = {
  hull: ShipHull;
  team: Team;
  opacity: number;
  ripple?: ShieldRipple;
  simTime?: number;
};

export function createShieldHexShaderMaterial(hull: ShipHull, team: Team): ShaderMaterial {
  const { hexScale, edgeWidth, maxAlpha } = getShieldVisuals(hull);
  const mat = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    uniforms: {
      uTime: { value: 0 },
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
      uRippleCount: { value: 0 },
      uRippleData: { value: Array.from({ length: SHADER_MAX_RIPPLES }, () => new Vector4(0, 0, 1, 0)) },
      uRippleT0s: { value: new Array<number>(SHADER_MAX_RIPPLES).fill(-999) as number[] },
      uRippleSpeed: { value: SHIELD_RIPPLE_TUNING.defaultSpeed },
      uRippleWidthBase: { value: SHIELD_RIPPLE_TUNING.baseWidth },
      uRippleBlendMode: { value: SHIELD_RIPPLE_TUNING.blendMode },
      uRippleIgnoreMaxAlpha: { value: SHIELD_RIPPLE_TUNING.ignoreMaxAlpha ? 1.0 : 0.0 },
      uRippleColorMul: { value: SHIELD_RIPPLE_TUNING.colorMul },
      uRippleStrength: { value: SHIELD_RIPPLE_TUNING.strength },
      uDisplacementScale: { value: SHIELD_RIPPLE_TUNING.displacementScale },
    },
    vertexShader: `
      varying vec3 vWorldPos;
      varying vec3 vCenter;
      varying float vDisplacement;
      
      uniform float uTime;
      uniform int uRippleCount;
      uniform float uRippleSpeed;
      uniform float uRippleWidthBase;
      uniform float uDisplacementScale;
      const int SHADER_MAX_RIPPLES = ${SHADER_MAX_RIPPLES};
      uniform vec4 uRippleData[SHADER_MAX_RIPPLES];
      uniform float uRippleT0s[SHADER_MAX_RIPPLES];

      void main() {
        vec3 N = normalize(position);
        float displacement = 0.0;
        
        for (int i = 0; i < SHADER_MAX_RIPPLES; i++) {
          if (i >= uRippleCount) break;
          float t = uTime - uRippleT0s[i];
          vec3 dir = normalize(uRippleData[i].xyz);
          float amp = uRippleData[i].w;
          
          if (t > 0.0 && amp > 0.0) {
            // Calculate angle between vertex normal and ripple direction
            // Since we are in local space and it's a sphere, normal is position normalized
            // But we need world space direction relative to model rotation?
            // Actually, uRippleData is likely in world space.
            // Let's assume uRippleData is in local space or we transform it.
            // Wait, the ripple direction is passed from game logic which is usually world space.
            // But the shader operates in local space for 'position'.
            // We need to be careful. The original fragment shader used vWorldPos to calculate N.
            // So ripples are in world space.
            
            // We need world normal for dot product
            vec3 worldNormal = normalize(mat3(modelMatrix) * N);
            
            float ang = acos(clamp(dot(worldNormal, dir), -1.0, 1.0));
            float radius = t * uRippleSpeed;
            float width = max(uRippleWidthBase, 0.05);
            
            // Simple wave function
            float dist = ang - radius;
            float wave = exp(-dist * dist * 20.0) * sin(dist * 20.0);
            
            // Decay over time
            float decay = exp(-t * 2.0);
            
            displacement += wave * amp * decay;
          }
        }
        
        vDisplacement = displacement;
        vec3 displacedPosition = position + N * displacement * uDisplacementScale;
        
        vec4 wp = modelMatrix * vec4(displacedPosition, 1.0);
        vWorldPos = wp.xyz;
        vCenter = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      varying vec3 vWorldPos;
      varying vec3 vCenter;
      varying float vDisplacement;
      
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
      const int SHADER_MAX_RIPPLES = ${SHADER_MAX_RIPPLES};
      uniform vec4 uRippleData[SHADER_MAX_RIPPLES];
      uniform float uRippleT0s[SHADER_MAX_RIPPLES];
      uniform float uRippleBlendMode;
      uniform float uRippleIgnoreMaxAlpha;
      uniform float uRippleColorMul;
      uniform float uRippleStrength;

      float hash(vec2 p){return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453);}
      
      // Simple noise for dissipation
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f*f*(3.0-2.0*f);
        return mix(mix(hash(i + vec2(0.0,0.0)), hash(i + vec2(1.0,0.0)), f.x),
                   mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0,1.0)), f.x), f.y);
      }

      float sdHexagon(vec2 p, float r) {
        const vec3 k = vec3(-0.8660254, 0.5, 0.5773503);
        p = abs(p);
        p -= 2.0 * min(dot(k.xy, p), 0.0) * k.xy;
        p -= vec2(clamp(p.x, -k.z * r, k.z * r), r);
        return length(p) * sign(p.y);
      }
      vec2 hexSkew(vec2 p) {
        return vec2((2.0/3.0) * p.x, (-1.0/3.0) * p.x + (0.57735026919) * p.y);
      }
      vec2 hexUnskew(vec2 h) {
        return vec2(1.5 * h.x, 0.86602540378 * h.x + 1.73205080757 * h.y);
      }
      vec2 hexLocal(vec2 p) {
        vec2 a = hexSkew(p);
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

      // Calculate ripple intensity for a specific channel offset
      float getRippleIntensity(vec3 N, float offset) {
        float total = 0.0;
        for (int i = 0; i < SHADER_MAX_RIPPLES; i++) {
          if (i >= uRippleCount) break;
          float t = uTime - uRippleT0s[i];
          vec3 dir = normalize(uRippleData[i].xyz);
          float amp = uRippleData[i].w;
          if (t > 0.0 && amp > 0.0) {
            float ang = acos(clamp(dot(N, dir), -1.0, 1.0));
            float radius = t * uRippleSpeed + offset; // Apply chromatic offset to radius
            float width = max(uRippleWidthBase, 0.05);
            float norm = (ang - radius) / width;
            
            // Add noise to the ripple ring
            // Use angular position and time for noise lookup
            // We need a coordinate system for the noise on the sphere surface relative to the ripple center
            // But simple UV based on N is easier
            float nVal = noise(vec2(ang * 10.0, t * 5.0));
            
            // Dissipation: break up the ring as it expands
            float dissipation = smoothstep(0.0, 1.0, 1.0 - t * 0.5);
            
            float gaussian = exp(-norm * norm * 3.5);
            float ramp = smoothstep(0.0, 0.16, t);
            
            // Modulate by noise
            float noisyGaussian = gaussian * (0.8 + 0.4 * nVal);
            
            total += noisyGaussian * ramp * amp * exp(-t * 0.65) * dissipation;
          }
        }
        return total;
      }

      void main(){
        vec3 N = normalize(vWorldPos - vCenter);
        vec2 uv = vec2(atan(N.z, N.x)/6.2831853 + 0.5, acos(N.y)/3.1415926);
        uv *= uHexScale;
        vec2 cell = hexLocal(uv);
        float d = sdHexagon(cell, 0.5);
        float w = max(0.0001, uEdgeWidth);
        float border = 1.0 - smoothstep(0.0, w, abs(d));

        // Chromatic aberration for ripples
        float rippleR = getRippleIntensity(N, 0.01);
        float rippleG = getRippleIntensity(N, 0.0);
        float rippleB = getRippleIntensity(N, -0.01);
        
        float rippleMax = max(rippleR, max(rippleG, rippleB));
        vec3 rippleColor = vec3(rippleR, rippleG, rippleB);

        float sparkle = hash(floor(uv));
        float edgeGlow = border * (0.7 + 0.3 * sparkle);
        
        // Use the max intensity for the glow alpha contribution
        float rippleGlow = rippleMax * (1.0 + 0.5 * border) * uRippleColorMul;
        
        // Tint the ripple with the team color but keep the chromatic edges
        vec3 rippleTint = mix(vec3(1.0), uTint, 0.35) * uRippleColorMul;
        vec3 finalRippleColor = rippleColor * rippleTint;

        float fill = clamp(1.0 - border, 0.0, 1.0);
        vec3 base = uTint * (0.9 * edgeGlow + uFillTintMul * fill);
        vec3 baseCol = clamp(base, 0.0, 1.0);
        if(uTeamIsRed > 0.5 && uEnableRedBoost > 0.5) {
          baseCol = clamp(pow(baseCol, vec3(uRedBoostPow)) * uRedBoostMul, 0.0, 1.0);
        }

        vec3 col;
        if(uRippleBlendMode < 0.5) {
          col = clamp(baseCol + finalRippleColor * rippleGlow, 0.0, 1.0);
        } else {
          vec3 added = baseCol + finalRippleColor * rippleGlow;
          col = added / (1.0 + added);
        }

        float alphaBase = uOpacity * uMaxAlpha * (edgeGlow * uEdgeAlphaMul + fill * uFillAlphaMul);
        alphaBase = max(alphaBase, uOpacity * uMaxAlpha * uMinAlphaFloor);
        float rippleContribution = clamp(rippleMax * (0.5 + 0.5 * border) * uRippleStrength, 0.0, 1.0);
        float alpha;
        if(uRippleIgnoreMaxAlpha > 0.5) {
          alpha = clamp(alphaBase + rippleContribution, 0.0, 1.0);
        } else {
          alpha = clamp(alphaBase + rippleContribution * uMaxAlpha, 0.0, 1.0);
        }
        if(alpha <= 0.002) discard;
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });

  // Mark shield materials as force-write so the selective-bloom provider
  // will not disable their colorWrite when postprocessing/composer is active.
  try {
    if (!mat.userData) mat.userData = {} as any;
    (mat.userData as any).__copilot_forceColorWrite = true;
  } catch { /* defensive: ignore in odd test environments */ }

  return mat;
}

export const ShieldHexMaterial: React.FC<ShieldHexMaterialProps> = ({ hull, team, opacity, ripple, simTime }) => {
  const mat = useMemo(() => createShieldHexShaderMaterial(hull, team), [hull, team]);

  useFrame((_, dt) => {
    (mat.uniforms as any).uTime.value += dt;
  });

  useEffect(() => {
    (mat.uniforms as any).uOpacity.value = Math.max(0, Math.min(1, opacity));
  }, [opacity, mat]);

  useEffect(() => {
    (mat.uniforms as any).uTint.value.copy(colorFromConfig(team === 'blue' ? TEAM_COLORS.blue : SHIELD_TUNING.redTint));
    (mat.uniforms as any).uTeamIsRed.value = team === 'red' ? 1.0 : 0.0;
    (mat.uniforms as any).uEnableRedBoost.value = SHIELD_TUNING.enableRedBoost ? 1.0 : 0.0;
    (mat.uniforms as any).uRedBoostPow.value = SHIELD_TUNING.redBoostPower;
    (mat.uniforms as any).uRedBoostMul.value = SHIELD_TUNING.redBoostMultiplier;
  }, [team, mat]);

  useEffect(() => {
    const uniforms = mat.uniforms as any;
    const maxRipples = Math.min(SHIELD_RIPPLE_TUNING.maxRipples ?? 3, SHADER_MAX_RIPPLES);
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
    uniforms.uDisplacementScale.value = SHIELD_RIPPLE_TUNING.displacementScale;
  }, [ripple, simTime, mat]);

  return <primitive object={mat} attach="material" />;
};
