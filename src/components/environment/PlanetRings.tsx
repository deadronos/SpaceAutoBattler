import { useEffect, useMemo, useRef } from 'react';
import type { Mesh } from 'three';
import { AdditiveBlending, MeshBasicMaterial, NormalBlending, ShaderMaterial } from 'three';
import { useFrame } from '@react-three/fiber';
import { colorFromConfig } from '../../utils/color.js';
import { RENDER_ORDER_TRANSLUCENT_ADDITIVE } from '../../renderer/sceneLayerOrder.js';
import { useUiStore } from '../../game/uiStore.js';
import { isCopilotDebugEnabled } from '../../utils/copilotDebug.js';
import { registerDebugHook, clearDebugHooks } from '../../debug/copilotDebugRegistry.js';
import { reportMaterialError } from '../../utils/errorReporting.js';
import type { PlanetRingsUniforms } from '../../types/renderer.js';
import { createPlanetRingGeometry } from '../../renderer/environment/planetRingGeometry.js';
import {
  createPlanetRingBasicMaterial,
  createPlanetRingMaterial,
} from '../../renderer/environment/planetRingMaterial.js';

interface PlanetRingsProps {
  /** Inner radius of the rings */
  innerRadius: number;
  /** Outer radius of the rings */
  outerRadius: number;
  /** Ring color */
  color?: string;
  /** Ring opacity */
  opacity?: number;
  /** Number of ring segments */
  segments?: number;
  /** Rotation speed in radians per second */
  rotationSpeed?: number;
  /** Brightness multiplier for the ring base color */
  brightness?: number;
  /** Fresnel highlight strength (view-dependent) */
  fresnelStrength?: number;
  /** Optional tint color to bias the ring color when postprocessing is off */
  tintColor?: string;
  /** Optional tint mix factor (0..1). When undefined, the renderer chooses a conservative default when postprocessing is off. */
  tintMix?: number;
  /** If true, the ring is intended to be bloom-only (artists opt-in). When true the renderer/bloom manager may route this object's color contributions to the bloom pass and avoid preserving colorWrite. */
  bloomOnly?: boolean;
  /** Procedural banding controls */
  bandFrequency?: number;
  bandStrength?: number;
  bandNoiseScale?: number;
  bandDarkness?: number;
  /** Planet shadowing controls */
  planetCenter?: { x: number; y: number; z: number };
  planetRadius?: number;
  shadowStrength?: number;
  /** Penumbra as fraction of planet radius */
  penumbra?: number;
  /** World-space directional light vector (points from origin toward the light). */
  lightDir?: { x: number; y: number; z: number };
  /** Enable/disable the rings */
  enabled?: boolean;
}

export function PlanetRings({
  innerRadius,
  outerRadius,
  color = '#ccaa88',
  opacity = 0.6,
  segments = 128,
  rotationSpeed = 0.001,
  brightness = 1.4,
  fresnelStrength = 1.2,
  tintColor,
  tintMix,
  bloomOnly = false,
  bandFrequency = 180.0,
  bandStrength = 0.6,
  bandNoiseScale = 0.8,
  bandDarkness = 0.6,
  planetCenter = { x: 0, y: 0, z: 0 },
  planetRadius = 1000,
  shadowStrength = 0.6,
  penumbra = 0.04,
  lightDir = { x: 0.2516, y: 0.1509, z: 0.956 },
  enabled = true,
}: PlanetRingsProps): React.ReactElement | null {
  const meshRef = useRef<Mesh>(null);

  const geometry = useMemo(
    () => createPlanetRingGeometry(innerRadius, outerRadius, segments),
    [innerRadius, outerRadius, segments],
  );

  const material = useMemo(
    () =>
      createPlanetRingMaterial({
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
      }),
    [
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
    ],
  );

  const basicMaterial = useMemo(
    () => createPlanetRingBasicMaterial({ tintColor, opacity, bloomOnly }),
    [tintColor, opacity, bloomOnly],
  );

  // Read global UI flag to detect when postprocessing is disabled.
  const postprocessingEnabled = useUiStore((s) => s.postprocessingEnabled);

  const materialToUse = postprocessingEnabled ? material : basicMaterial;

  // Type guard to check if material has uniforms (ShaderMaterial)
  const isShaderMat = (
    mat: ShaderMaterial | MeshBasicMaterial,
  ): mat is ShaderMaterial & { uniforms: PlanetRingsUniforms } => {
    return 'uniforms' in mat;
  };

  // Update uniforms and blending when postprocessing toggles or props change.
  useEffect(() => {
    try {
      if (isShaderMat(materialToUse)) {
        const uniforms = materialToUse.uniforms;
        const desiredTintMix =
          typeof tintMix === 'number' ? tintMix : postprocessingEnabled ? 0.0 : 0.9;
        uniforms.uTintMix.value = desiredTintMix;
        uniforms.uTintColor.value = colorFromConfig(tintColor ?? '#d9efff');
        uniforms.uBrightness.value = postprocessingEnabled ? brightness : Math.max(brightness, 1.6);
        uniforms.uOpacity.value = postprocessingEnabled ? opacity : Math.max(0.45, opacity);
        uniforms.uBandFreq.value = bandFrequency;
        uniforms.uBandStrength.value = bandStrength;
        uniforms.uBandNoiseScale.value = bandNoiseScale;
        uniforms.uBandDarkness.value = bandDarkness;
        uniforms.uPlanetCenter.value = [planetCenter.x, planetCenter.y, planetCenter.z];
        uniforms.uPlanetRadius.value = planetRadius;
        uniforms.uShadowStrength.value = shadowStrength;
        uniforms.uPenumbra.value = penumbra;
        uniforms.uLightDir.value = [lightDir.x, lightDir.y, lightDir.z];
        try {
          materialToUse.blending = postprocessingEnabled ? AdditiveBlending : NormalBlending;
        } catch (error) {
          // Expected: Blending mode may be read-only
          reportMaterialError('blending', 'ringMaterial', error);
        }
        try {
          materialToUse.needsUpdate = true;
        } catch (error) {
          // Expected: Material may be disposed during React unmount cycle
          reportMaterialError('needsUpdate', 'ringMaterial', error);
        }
      }
    } catch (error) {
      // Expected: Material may be disposed during React unmount cycle
      reportMaterialError('uniformUpdate.postprocessing', 'ringMaterial', error);
    }
  }, [
    materialToUse,
    postprocessingEnabled,
    opacity,
    brightness,
    bandFrequency,
    bandStrength,
    bandNoiseScale,
    bandDarkness,
    planetCenter,
    planetRadius,
    shadowStrength,
    penumbra,
    lightDir,
    tintColor,
    tintMix,
  ]);

  // Keep uniforms in sync when props change
  useEffect(() => {
    try {
      if (isShaderMat(materialToUse)) {
        const uniforms = materialToUse.uniforms;
        uniforms.uOpacity.value = opacity;
        uniforms.uInnerRadius.value = innerRadius;
        uniforms.uOuterRadius.value = outerRadius;
        uniforms.uBrightness.value = brightness;
        uniforms.uFresnelStrength.value = fresnelStrength;
        uniforms.uBandFreq.value = bandFrequency;
        uniforms.uPlanetCenter.value = [planetCenter.x, planetCenter.y, planetCenter.z];
        uniforms.uPlanetRadius.value = planetRadius;
        uniforms.uPenumbra.value = penumbra;
        try {
          materialToUse.needsUpdate = true;
        } catch (error) {
          // Expected: Material may be disposed during React unmount cycle
          reportMaterialError('needsUpdate', 'ringMaterial', error);
        }
      }
    } catch (error) {
      // Expected: Material may be disposed during React unmount cycle
      reportMaterialError('uniformUpdate.props', 'ringMaterial', error);
    }
  }, [
    materialToUse,
    opacity,
    innerRadius,
    outerRadius,
    brightness,
    fresnelStrength,
    bandFrequency,
    planetCenter,
    planetRadius,
    penumbra,
  ]);

  // Attach debug helpers once the material exists so we can adjust uniforms
  // and render order from the console during interactive debugging. Hooks are
  // registered under the `rings` owner so they are cleaned up on unmount.
  try {
    if (isCopilotDebugEnabled()) {
      try {
        registerDebugHook('__copilot_ringMaterial', materialToUse, 'rings');
        const setRingOpacity = (v: unknown) => {
          try {
            const n = Number(v);
            if (!Number.isFinite(n)) return { set: false, reason: 'not-a-number' };
            if (isShaderMat(materialToUse)) {
              materialToUse.uniforms.uOpacity.value = Math.max(0, Math.min(n, 1));
            } else if ('opacity' in materialToUse) {
              materialToUse.opacity = Math.max(0, Math.min(n, 1));
            }
            try {
              materialToUse.needsUpdate = true;
            } catch (error) {
              // Expected: Material may be disposed
              reportMaterialError('debug.needsUpdate', 'ringMaterial', error);
            }
            const resultValue = isShaderMat(materialToUse)
              ? materialToUse.uniforms.uOpacity.value
              : 'opacity' in materialToUse
                ? materialToUse.opacity
                : undefined;
            return { set: true, value: resultValue };
          } catch (e) {
            return { set: false, reason: String(e) };
          }
        };
        registerDebugHook('__copilot_setRingOpacity', setRingOpacity, 'rings');
        const setRingRenderOrder = (v: unknown) => {
          try {
            const n = Number(v);
            if (!meshRef.current) return { set: false, reason: 'no-mesh' };
            if (!Number.isFinite(n)) return { set: false, reason: 'not-a-number' };
            meshRef.current.renderOrder = Math.floor(n);
            return { set: true, value: meshRef.current.renderOrder };
          } catch (e) {
            return { set: false, reason: String(e) };
          }
        };
        registerDebugHook('__copilot_setRingRenderOrder', setRingRenderOrder, 'rings');
      } catch (error) {
        // Expected: Debug helper attachment may fail in some environments
        reportMaterialError('debug.attach', 'ringMaterial', error);
      }
    }
  } catch (error) {
    // Expected: isCopilotDebugEnabled check may fail in some environments
    reportMaterialError('debug.check', 'ringMaterial', error);
  }

  useEffect(() => () => clearDebugHooks('rings'), []);

  useFrame((_, delta) => {
    if (meshRef.current && rotationSpeed !== 0) {
      meshRef.current.rotation.z += rotationSpeed * delta;
    }
  });

  if (!enabled) return null;

  // Rings use additive blending and translucent layer ordering to render after
  // opaque geometry (planets, star cores) while respecting depth occlusion.
  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      material={materialToUse}
      rotation={[-Math.PI / 2, 0, 0]}
      renderOrder={RENDER_ORDER_TRANSLUCENT_ADDITIVE}
    />
  );
}

export default PlanetRings;
