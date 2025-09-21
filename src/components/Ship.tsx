import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import type React from 'react';
import { Box3, Color, Sphere, type Group, type Mesh } from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { useGLTF } from '@react-three/drei';
import type { ShipEntity, ShipHull } from '../types/index.js';
import { getShieldVisuals } from '../config/renderer.js';
import { useFrame as useRenderFrame } from '@react-three/fiber';
import { SHIP_MODEL_PATHS } from '../assets/ships.js';
import { getMaterial } from '../renderer/materialRegistry.js';

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

  // Compute a per-model bounding radius to size the shield bubble properly.
  const fallbackRadiusByHull: Record<ShipHull, number> = {
    fighter: 1.6,
    corvette: 2.1,
    frigate: 2.8,
    destroyer: 3.4,
    carrier: 4.4,
  };

  const modelRadius = useMemo(() => {
    // If scene not loaded, return a conservative fallback based on hull.
    if (!scene) return fallbackRadiusByHull[entity.ship.hull] ?? 2.0;
    const box = new Box3().setFromObject(scene);
    const sphere = new Sphere();
    box.getBoundingSphere(sphere);
    // Slight margin so the bubble sits outside the hull — configurable per hull.
    const { margin } = getShieldVisuals(entity.ship.hull);
    return sphere.radius * margin;
  }, [scene, entity.ship.hull]);

  useFrame(() => {
    const ref = group.current;
    if (!ref) return;
    ref.position.copy(entity.transform.position);
    ref.quaternion.copy(entity.transform.rotation);
    ref.scale.setScalar(entity.transform.scale);
  });

  // Ship object no longer renders turret gizmos or flashes; these are handled by TurretObject or projectile visuals.

  if (scene) {
    return (
      <group ref={group} dispose={null}>
        <primitive object={scene} />
        <ShieldBubble entity={entity} radius={modelRadius} />
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
      <ShieldBubble entity={entity} radius={modelRadius} />
    </group>
  );
}

function ShieldBubble({ entity, radius }: { entity: ShipEntity; radius?: number }): React.ReactElement {
  const meshRef = useRef<Mesh>(null);

  useRenderFrame((_, dt) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    // Anchor to parent ship: local origin with identity rotation.
    mesh.position.set(0, 0, 0);
    mesh.quaternion.identity();
    const fallbackByHull: Record<ShipHull, number> = {
      fighter: 1.8,
      corvette: 2.3,
      frigate: 3.0,
      destroyer: 3.7,
      carrier: 4.6,
    };
    const r = radius ?? fallbackByHull[entity.ship.hull] ?? 2.0;
    mesh.scale.setScalar(r);
  });
  // Derived props for material
  const s = entity.ship.shield / Math.max(1, entity.ship.maxShield);
  const opacity = Math.max(0, Math.min(1, s));
  const ripples = entity.shieldRipples;
  const ripple = ripples && ripples.length > 0 ? ripples[ripples.length - 1] : undefined;

  const kind = getShieldVisuals(entity.ship.hull).materialKind;
  const key = `shield:${kind}`;
  const Mat = (getMaterial<{
    hull: ShipHull; team: any; opacity: number; ripple?: any;
  }>(key)) ?? getMaterial('shield:hex')!;

  return (
    <mesh ref={meshRef} renderOrder={-1} frustumCulled={false}>
      <sphereGeometry args={[1, 64, 64]} />
      <Mat hull={entity.ship.hull} team={entity.ship.team} opacity={opacity} ripple={ripple} />
    </mesh>
  );
}
