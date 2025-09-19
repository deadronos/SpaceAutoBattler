import { Canvas, useFrame } from '@react-three/fiber';
import { Suspense } from 'react';
import type { Archetype } from 'miniplex';
import { Color } from 'three';
import type { GameEntity, ProjectileEntity, ShipEntity } from '../types/index.js';
import { useGameState, useOptionalGameState } from '../game/context.js';
import { updateGame } from '../game/systems.js';
import { useArchetypeEntities } from '../hooks/useArchetypeEntities.js';
import { ShipObject } from './Ship.js';
import { ProjectileObject } from './Projectile.js';
import { SeededRng } from '../utils/rng.js';

export function Battlefield(): JSX.Element {
  const state = useOptionalGameState();

  if (!state) {
    return <div className="loading-overlay">Preparing simulation…</div>;
  }

  return (
    <Canvas shadows camera={{ position: [0, 16, 34], fov: 50 }} dpr={[1, 2]}>
      <color attach="background" args={[new Color('#02030b')]} />
      <fog attach="fog" args={['#02030b', 40, 110]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[24, 32, 10]} intensity={1.2} castShadow shadow-mapSize={[1024, 1024]} />
      <pointLight position={[-18, 24, -12]} intensity={0.8} color="#88aaff" />
      <Suspense fallback={null}>
        <ShipsLayer archetype={state.queries.ships} />
        <ProjectilesLayer archetype={state.queries.projectiles} />
      </Suspense>
      <BattlefieldSystems />
      <StarsField />
      <gridHelper args={[120, 20, '#203050', '#101725']} position={[0, -2.2, 0]} />
    </Canvas>
  );
}

function BattlefieldSystems(): JSX.Element {
  const state = useGameState();
  useFrame((_, delta) => {
    const clamped = Math.min(delta, 0.05);
    updateGame(state, clamped);
  });
  return <></>;
}

function ShipsLayer({ archetype }: { archetype: Archetype<GameEntity, ['ship']> }): JSX.Element {
  const ships = useArchetypeEntities<ShipEntity>(archetype);
  return (
    <>
      {ships.map((ship) => (
        <ShipObject key={ship.id} entity={ship} />
      ))}
    </>
  );
}

function ProjectilesLayer({ archetype }: { archetype: Archetype<GameEntity, ['projectile']> }): JSX.Element {
  const projectiles = useArchetypeEntities<ProjectileEntity>(archetype);
  return (
    <>
      {projectiles.map((projectile) => (
        <ProjectileObject key={projectile.id} entity={projectile} />
      ))}
    </>
  );
}

function StarsField(): JSX.Element {
  return (
    <group>
      <points position={[0, 0, 0]}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={STAR_POSITIONS.length / 3}
            array={STAR_POSITIONS}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial color="#ffffff" size={0.3} sizeAttenuation depthWrite={false} />
      </points>
    </group>
  );
}

const STAR_POSITIONS = (() => {
  const positions: number[] = [];
  const spread = 180;
  const rng = new SeededRng(2024);
  for (let i = 0; i < 800; i += 1) {
    const x = (rng.next() - 0.5) * spread;
    const y = rng.next() * spread * 0.6 + 10;
    const z = (rng.next() - 0.5) * spread;
    positions.push(x, y, z);
  }
  return new Float32Array(positions);
})();
