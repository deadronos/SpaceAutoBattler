import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import type React from 'react';
import { Color, type Group } from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { useGLTF } from '@react-three/drei';
import type { ShipEntity } from '../types/index.js';
import { SHIP_MODEL_PATHS } from '../assets/ships.js';

export function resolveModelPath(modelKey?: string): string {
  const key = (modelKey ?? 'fighter') as keyof typeof SHIP_MODEL_PATHS;
  return SHIP_MODEL_PATHS[key] ?? SHIP_MODEL_PATHS.fighter;
}

export function ShipObject({ entity }: { entity: ShipEntity }): React.ReactElement {
  const group = useRef<Group>(null);

  // Resolve path via helper to ensure it's always defined.
  const modelPath = resolveModelPath(entity.model);
  const hasValidPath = typeof modelPath === 'string' && modelPath.length > 0;

  // Use drei's useGLTF which provides caching and convenience helpers.
  const gltf = hasValidPath ? (useGLTF(modelPath) as GLTF) : null;
  const scene = useMemo(() => (gltf ? gltf.scene.clone(true) : null), [gltf?.scene]);

  useFrame(() => {
    const ref = group.current;
    if (!ref) return;
    ref.position.copy(entity.transform.position);
    ref.quaternion.copy(entity.transform.rotation);
    ref.scale.setScalar(entity.transform.scale);
  });

  if (scene) {
    return (
      <group ref={group} dispose={null}>
        <primitive object={scene} />
      </group>
    );
  }

  // Fallback: render a simple placeholder if the model path is invalid.
  return (
    <group ref={group} dispose={null}>
      <mesh castShadow receiveShadow>
        <coneGeometry args={[0.6, 1.6, 6]} />
        <meshStandardMaterial color={entity.ship.team === 'blue' ? new Color('#77aaff') : new Color('#ff7788')} />
      </mesh>
    </group>
  );
}
