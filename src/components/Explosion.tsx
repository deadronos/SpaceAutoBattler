import React, { useEffect, useMemo, useRef } from 'react';
import type { Mesh } from 'three';
import { useBloomRegistration } from '../renderer/bloom/index.js';
import { getMaterial } from '../renderer/materialRegistry.js';

// Placeholder explosion mesh; when explosion entities are added, this can be used.
export function ExplosionObject({ position = [0,0,0], size = 1 }: { position?: [number, number, number]; size?: number }): React.ReactElement {
  const ref = useRef<Mesh>(null);
  useBloomRegistration(ref, { group: 'explosions' });
  const Mat = useMemo(() => getMaterial('explosion:smoke'), []);
  return (
    <mesh ref={ref} position={position} scale={[size, size, size]} frustumCulled={false}>
      <sphereGeometry args={[1, 16, 16]} />
      {Mat ? <Mat /> : <meshStandardMaterial color="#888888" roughness={0.9} metalness={0} />}
    </mesh>
  );
}

export default ExplosionObject;
