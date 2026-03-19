import { useMemo, useRef } from 'react';
import type { Mesh } from 'three';
import { Vector3 } from 'three';
import { useFrame } from '@react-three/fiber';

interface ParallaxBillboardProps {
  /** Position of the billboard */
  position: [number, number, number];
  /** Size of the billboard */
  size: number;
  /** Billboard texture or color */
  color?: string;
  /** Billboard opacity */
  opacity?: number;
  /** Parallax factor (0 = no parallax, 1 = normal, > 1 = exaggerated) */
  parallaxFactor?: number;
  /** Enable/disable the billboard */
  enabled?: boolean;
}

export function ParallaxBillboard({
  position,
  size,
  color = '#4a6fa5',
  opacity = 0.8,
  parallaxFactor = 0.1,
  enabled = true,
}: ParallaxBillboardProps): React.ReactElement | null {
  const meshRef = useRef<Mesh>(null);
  const basePosition = useMemo(() => new Vector3(...position), [position]);

  // Apply parallax effect based on camera movement
  useFrame(({ camera }) => {
    if (!meshRef.current || parallaxFactor === 0) return;

    // Calculate camera offset from origin
    const cameraOffset = new Vector3().copy(camera.position);

    // Apply parallax offset - distant objects move less
    const parallaxOffset = cameraOffset.multiplyScalar(parallaxFactor);

    // Set billboard position with parallax
    const finalPosition = new Vector3().copy(basePosition).add(parallaxOffset);

    meshRef.current.position.copy(finalPosition);

    // Make billboard face the camera
    meshRef.current.lookAt(camera.position);
  });

  if (!enabled) {
    return null;
  }

  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[size, size]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={opacity}
        depthWrite={false}
        depthTest={true}
      />
    </mesh>
  );
}
