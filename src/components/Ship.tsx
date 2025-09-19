import { useFrame, useLoader } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import type { Group } from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { ShipEntity } from '../types/index.js';
import { SHIP_MODEL_PATHS } from '../assets/ships.js';

export function resolveModelPath(modelKey?: string): string {
  const key = (modelKey ?? 'fighter') as keyof typeof SHIP_MODEL_PATHS;
  return SHIP_MODEL_PATHS[key] ?? SHIP_MODEL_PATHS.fighter;
}

export function ShipObject({ entity }: { entity: ShipEntity }): JSX.Element {
  const group = useRef<Group>(null);

  // Resolve path via helper to ensure it's always defined.
  const modelPath = resolveModelPath(entity.model);

  const gltf = useLoader(GLTFLoader, modelPath) as GLTF;
  const scene = useMemo(() => gltf.scene.clone(true), [gltf.scene]);

  useFrame(() => {
    const ref = group.current;
    if (!ref) return;
    ref.position.copy(entity.transform.position);
    ref.quaternion.copy(entity.transform.rotation);
    ref.scale.setScalar(entity.transform.scale);
  });

  return (
    <group ref={group} dispose={null}>
      <primitive object={scene} />
    </group>
  );
}
