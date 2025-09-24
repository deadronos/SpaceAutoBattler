import { useMemo, useRef } from 'react';
import type { Mesh } from 'three';
import { Vector3 } from 'three';
import { useFrame } from '@react-three/fiber';
import type { StarLightConfig } from '../../config/environment.js';

interface StarDiskProps {
  config: StarLightConfig;
  /** Size of the star disk billboard in world units */
  size?: number;
  /** Opacity of the star disk */
  opacity?: number;
  /** Enable/disable the star disk */
  enabled?: boolean;
}

export function StarDisk({ config, size = 800, opacity = 0.12, enabled = true }: StarDiskProps): React.ReactElement | null {
  const meshRef = useRef<Mesh>(null);

  const position = useMemo(() => {
    // Place the star disk far away in the direction of the star light
    const direction = new Vector3(config.direction.x, config.direction.y, config.direction.z).normalize();
    const distance = Math.max(config.distance * 0.8, 8000); // Slightly closer than the light itself
    return direction.multiplyScalar(-distance).toArray();
  }, [config.direction.x, config.direction.y, config.direction.z, config.distance]);

  // Make the disk always face the camera (billboard behavior)
  useFrame(({ camera }) => {
    if (meshRef.current) {
      meshRef.current.lookAt(camera.position);
    }
  });

  if (!enabled) {
    return null;
  }

  return (
    <mesh ref={meshRef} position={position as [number, number, number]}>
      <circleGeometry args={[size, 32]} />
      <meshBasicMaterial
        color={config.color}
        transparent
        opacity={opacity}
        depthWrite={false}
        depthTest={true}
      />
    </mesh>
  );
}