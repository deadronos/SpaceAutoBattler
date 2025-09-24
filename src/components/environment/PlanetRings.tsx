import { useMemo, useRef } from 'react';
import type { Mesh } from 'three';
import { Color, RingGeometry, ShaderMaterial } from 'three';
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
  segments = 64,
  rotationSpeed = 0.001,
  enabled = true,
}: PlanetRingsProps): React.ReactElement | null {
  const meshRef = useRef<Mesh>(null);

  // Create ring geometry
  const geometry = useMemo(() => {
    return new RingGeometry(innerRadius, outerRadius, segments, 1);
  }, [innerRadius, outerRadius, segments]);

  // Create ring material with alpha gradient
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
          
          // Calculate radius from center
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
          // Calculate normalized radius (0 at inner, 1 at outer)
          float normalizedRadius = (vRadius - 0.0) / 1.0;
          
          // Create alpha gradient that fades towards edges
          float alpha = 1.0 - abs(normalizedRadius - 0.5) * 2.0;
          alpha = smoothstep(0.0, 0.3, alpha) * smoothstep(1.0, 0.7, alpha);
          
          // Add some ring structure variation
          float ringPattern = sin(normalizedRadius * 20.0) * 0.1 + 0.9;
          alpha *= ringPattern;
          
          // Fade at inner and outer edges
          float edgeFade = smoothstep(0.0, 0.1, normalizedRadius) * 
                          smoothstep(1.0, 0.9, normalizedRadius);
          alpha *= edgeFade;
          
          gl_FragColor = vec4(uColor, alpha * uOpacity);
        }
      `,
      transparent: true,
      depthWrite: false,
    });
  }, [color, opacity, innerRadius, outerRadius]);

  // Animate rotation
  useFrame((_, delta) => {
    if (meshRef.current && rotationSpeed !== 0) {
      meshRef.current.rotation.z += rotationSpeed * delta;
    }
  });

  if (!enabled) {
    return null;
  }

  return (
    <mesh ref={meshRef} geometry={geometry} material={material} rotation={[-Math.PI / 2, 0, 0]} />
  );
}