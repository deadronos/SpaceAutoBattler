import { useEffect, useMemo, useRef } from 'react';
import type { Mesh } from 'three';
import { useFrame } from '@react-three/fiber';
import { RENDER_ORDER_TRANSLUCENT_ADDITIVE } from '../../renderer/sceneLayerOrder.js';
import { useUiStore } from '../../game/uiStore.js';
import { clearDebugHooks } from '../../debug/copilotDebugRegistry.js';
import { createPlanetRingGeometry } from '../../renderer/environment/planetRingGeometry.js';
import {
  createPlanetRingBasicMaterial,
  createPlanetRingMaterial,
} from '../../renderer/environment/planetRingMaterial.js';
import { installPlanetRingsDebug } from '../../debug/planetRingsDebug.js';
import { usePlanetRingUniforms } from '../../hooks/usePlanetRingUniforms.js';

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

  usePlanetRingUniforms({
    materialToUse,
    postprocessingEnabled,
    opacity,
    brightness,
    innerRadius,
    outerRadius,
    fresnelStrength,
    tintColor,
    tintMix,
    bandFrequency,
    bandStrength,
    bandNoiseScale,
    bandDarkness,
    planetCenter,
    planetRadius,
    shadowStrength,
    penumbra,
    lightDir,
  });

  // Attach debug helpers once the material exists so uniforms and render order
  // can be adjusted from the console during interactive debugging. Hooks are
  // registered under the `rings` owner so they are cleaned up on unmount.
  installPlanetRingsDebug({ materialToUse, meshRef });

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
