import { useMemo } from 'react';
import { AdditiveBlending, DoubleSide } from 'three';
import planetAtmosphereVertexShader from '../../renderer/shaders/planetAtmosphere.vertex.glsl';
import planetAtmosphereFragmentShader from '../../renderer/shaders/planetAtmosphere.fragment.glsl';
import { createGlslMaterial } from '../../renderer/materials/createGlslMaterial.js';
import { colorFromConfig } from '../../utils/color.js';

interface PlanetAtmosphereProps {
  /** Overall atmosphere brightness multiplier (0 disables the effect). */
  strength?: number;
  /** Atmosphere glow color. */
  color?: string;
  /** Fresnel power controlling how tight the limb glow hugs the silhouette. */
  falloff?: number;
  /** World-space direction from origin toward the star (forward-scatter source). */
  lightDir?: { x: number; y: number; z: number };
}

/**
 * Light-dependent, Rayleigh-ish atmosphere shell for a planet.
 *
 * The shell is additive and renders on both faces so the limb glows brightest
 * on the star-facing side and fades toward the night side. Depth testing is
 * left enabled so nearer opaque geometry occludes the atmosphere.
 *
 * @param {PlanetAtmosphereProps} props - Atmosphere appearance and lighting.
 * @returns {React.ReactElement} A primitive material for attachment to a mesh.
 */
export function PlanetAtmosphere({
  strength = 0.5,
  color = '#7fb2ff',
  falloff = 3.0,
  lightDir = { x: 0.2516, y: 0.1509, z: 0.956 },
}: PlanetAtmosphereProps) {
  const { x: lightX, y: lightY, z: lightZ } = lightDir;

  const material = useMemo(() => {
    return createGlslMaterial({
      uniforms: {
        uAtmosphereColor: { value: colorFromConfig(color) },
        uAtmosphereStrength: { value: strength },
        uAtmosphereFalloff: { value: falloff },
        uLightDir: { value: [lightX, lightY, lightZ] },
      },
      vertexShader: planetAtmosphereVertexShader,
      fragmentShader: planetAtmosphereFragmentShader,
      prependCommonGlsl: false,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      depthTest: true,
      side: DoubleSide,
    });
  }, [color, strength, falloff, lightX, lightY, lightZ]);

  // Return the material primitive for attachment; the caller provides geometry.
  return <primitive object={material} attach="material" />;
}
