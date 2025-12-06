import type React from 'react';
import { SeededRng } from '../../utils/rng.js';
import { WORLD_SIZE } from '../../game/config.js';

const STAR_POSITIONS = (() => {
  const positions: number[] = [];
  const spread = WORLD_SIZE * 0.9;
  const rng = new SeededRng(2024);
  for (let i = 0; i < 3500; i += 1) {
    const x = (rng.next() - 0.5) * spread;
    const y = rng.next() * (WORLD_SIZE * 0.4) + 40;
    const z = (rng.next() - 0.5) * spread;
    positions.push(x, y, z);
  }
  return new Float32Array(positions);
})();

/**
 * Renders a static star field background.
 * Uses a points mesh for performance.
 *
 * @returns {React.ReactElement} The star field component.
 */
export function StarsField(): React.ReactElement {
  return (
    <group>
      <points position={[0, 0, 0]}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[STAR_POSITIONS, 3]} />
        </bufferGeometry>
        <pointsMaterial color="#ffffff" size={0.9} sizeAttenuation depthWrite={false} />
      </points>
    </group>
  );
}
