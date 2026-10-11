import { useMemo } from 'react';
import { AdditiveBlending, DoubleSide } from 'three';
import planetRimVertexShader from '../../renderer/shaders/planetRim.vertex.glsl';
import planetRimFragmentShader from '../../renderer/shaders/planetRim.fragment.glsl';
import { createGlslMaterial } from '../../renderer/materials/createGlslMaterial.js';
import { colorFromConfig } from '../../utils/color.js';

interface PlanetRimShellProps {
  radius: number;
  rimStrength?: number;
  rimColor?: string;
}

export function PlanetRimShell({
  radius: _radius,
  rimStrength = 0.2,
  rimColor = '#ffffff',
}: PlanetRimShellProps) {
  const material = useMemo(() => {
    return createGlslMaterial({
      uniforms: {
        uRimStrength: { value: rimStrength },
        uRimColor: { value: colorFromConfig(rimColor) },
      },
      vertexShader: planetRimVertexShader,
      fragmentShader: planetRimFragmentShader,
      prependCommonGlsl: false,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      side: DoubleSide,
    });
  }, [rimStrength, rimColor]);

  // Return a mesh here by convention; the caller will provide the geometry via JSX
  return (
    // The parent will create a <mesh> and attach this material as a primitive
    // but we provide a primitive here to keep usage simple.
    // This component is intended to be used like:
    // <mesh>
    //   <sphereGeometry args={[radius * 1.02, widthSeg, heightSeg]} />
    //   <primitive object={material} attach="material" />
    // </mesh>
    // So we export the material for attachment instead.
    <primitive object={material} attach="material" />
  );
}
