import { useMemo } from 'react';
import { ShaderMaterial, AdditiveBlending, DoubleSide } from 'three';
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
    return new ShaderMaterial({
      uniforms: {
        uRimStrength: { value: rimStrength },
        uRimColor: { value: colorFromConfig(rimColor) },
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vViewPosition = -mvPosition.xyz;
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform float uRimStrength;
        uniform vec3 uRimColor;
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        void main() {
          vec3 normal = normalize(vNormal);
          if (!gl_FrontFacing) {
            normal = -normal;
          }
          vec3 viewDir = normalize(vViewPosition);
          float ndv = abs(dot(normal, viewDir));
          float fresnel = 1.0 - ndv;
          fresnel = pow(fresnel, 2.0);
          vec3 outColor = uRimColor * uRimStrength * fresnel;
          gl_FragColor = vec4(outColor, fresnel);
        }
      `,
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
