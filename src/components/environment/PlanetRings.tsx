import { useMemo, useRef } from 'react';
import type { Mesh } from 'three';
import { Color, RingGeometry, ShaderMaterial, DoubleSide, AdditiveBlending } from 'three';
import { useFrame } from '@react-three/fiber';

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
  enabled = true,
}: PlanetRingsProps): React.ReactElement | null {
  const meshRef = useRef<Mesh>(null);

  const geometry = useMemo(() => {
    return new RingGeometry(innerRadius, outerRadius, segments, 1);
  }, [innerRadius, outerRadius, segments]);

  const material = useMemo(() => {
    return new ShaderMaterial({
      uniforms: {
        uColor: { value: new Color(color) },
        uOpacity: { value: opacity },
        uInnerRadius: { value: innerRadius },
        uOuterRadius: { value: outerRadius },
      },
      vertexShader: `
        varying vec2 vUv;
        varying float vRadius;

        void main() {
          vUv = uv;
          // radius in [0,1] across the ring
          vec2 center = vec2(0.5, 0.5);
          vRadius = distance(vUv, center) * 2.0;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uOpacity;
        uniform float uInnerRadius;
        uniform float uOuterRadius;

        varying vec2 vUv;
        varying float vRadius;

        void main() {
          // Simple normalized radius used for patterns
          float normalizedRadius = clamp(vRadius, 0.0, 1.0);

          // Base alpha shaped as a bell around the middle of the ring
          float alpha = 1.0 - abs(normalizedRadius - 0.5) * 2.0;
          alpha = smoothstep(0.0, 0.4, alpha) * smoothstep(1.0, 0.6, alpha);

          // Fine ringing pattern
          float ringPattern = sin(normalizedRadius * 80.0) * 0.08 + 0.92;
          alpha *= ringPattern;

          // Edge fade near inner/outer radii
          float edgeFade = smoothstep(0.0, 0.05, normalizedRadius) * smoothstep(1.0, 0.95, normalizedRadius);
          alpha *= edgeFade;

          gl_FragColor = vec4(uColor, alpha * uOpacity);
        }
      `,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      side: DoubleSide,
      blending: AdditiveBlending,
    });
  }, [color, opacity, innerRadius, outerRadius]);

  useFrame((_, delta) => {
    if (meshRef.current && rotationSpeed !== 0) {
      meshRef.current.rotation.z += rotationSpeed * delta;
    }
  });

  if (!enabled) return null;

  // renderOrder set slightly higher than planet meshes so rings draw after planet depth pass
  return <mesh ref={meshRef} geometry={geometry} material={material} rotation={[-Math.PI / 2, 0, 0]} renderOrder={10} />;
}

export default PlanetRings;