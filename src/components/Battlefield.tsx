import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import { AxesHelper } from 'three';
import { Suspense } from 'react';
import type { Archetype } from 'miniplex';
import type React from 'react';
import { Color } from 'three';
import type { GameEntity, ProjectileEntity, ShipEntity, TurretEntity } from '../types/index.js';
import { useGameState, useOptionalGameState } from '../game/context.js';
import { updateGame } from '../game/systems.js';
import { useArchetypeEntities } from '../hooks/useArchetypeEntities.js';
import { ShipObject } from './Ship.js';
import { TurretObject } from './Turret.js';
import { ProjectileObject } from './Projectile.js';
import { SeededRng } from '../utils/rng.js';
import { CAMERA_DEFAULTS, FOG_DEFAULTS, WORLD_SIZE } from '../game/config.js';
import { useUiStore } from '../game/uiStore.js';

export function Battlefield(): React.ReactElement {
  const state = useOptionalGameState();

  if (!state) { 
    return <div className="loading-overlay">Preparing simulation…</div>;
  }

  return (
    <Canvas
      shadows
      camera={{ position: [...CAMERA_DEFAULTS.position], fov: CAMERA_DEFAULTS.fov, near: CAMERA_DEFAULTS.near, far: CAMERA_DEFAULTS.far }}
      dpr={[1, 2]}
    >
      <color attach="background" args={[new Color('#02030b')]} />
      <fog attach="fog" args={FOG_DEFAULTS} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[240, 320, 100]} intensity={1.2} castShadow shadow-mapSize={[1024, 1024]} />
      <pointLight position={[-180, 240, -120]} intensity={0.8} color="#88aaff" />
      <Suspense fallback={null}>
        <ShipsLayer archetype={state.queries.ships} />
        <TurretsLayer archetype={state.queries.turrets} />
        <ProjectilesLayer archetype={state.queries.projectiles} />
      </Suspense>
      <BattlefieldSystems />
      <StarsField />
      {/* Drei helpers for navigation and orientation */}
      <OrbitControls enableDamping makeDefault target={[0, 0, 0]} maxDistance={WORLD_SIZE * 2} minDistance={10} />
      {/* Replace manual gridHelper with @react-three/drei Grid for performance and features */}
      <Grid
        args={[WORLD_SIZE, WORLD_SIZE]}
        cellSize={50}
        sectionSize={500}
        cellColor="#203050"
        sectionColor="#101725"
        position={[0, -5, 0]}
        fadeDistance={WORLD_SIZE}
        infiniteGrid
      />
      <primitive object={new AxesHelper(200)} position={[0, 0, 0]} />
    </Canvas>
  );
}

function BattlefieldSystems(): React.ReactElement {
  const state = useGameState();
  const paused = useUiStore((s) => s.paused);
  const timeScale = useUiStore((s) => s.timeScale);
  useFrame((_, delta) => {
    // Mirror to state just in case context missed an update
    state.paused = paused;
    state.timeScale = timeScale;

    if (paused) return;
    const scaled = Math.min(delta * Math.max(timeScale, 0), 0.1);

    // Keep Rapier step in sync with visual rate; use integration parameters if available
    try {
      const params = (state.physicsWorld as any).integrationParameters;
      if (params && typeof params.dt === 'number') {
        params.dt = scaled;
      }
    } catch {
      /* ignore */
    }

    updateGame(state, scaled);
  });
  return <></>;
}

function ShipsLayer({ archetype }: { archetype: Archetype<GameEntity, ['ship']> }): React.ReactElement {
  const ships = useArchetypeEntities<ShipEntity>(archetype);
  return (
    <>
      {ships.map((ship) => (
        <ShipObject key={ship.id} entity={ship} />
      ))}
    </>
  );
}

function ProjectilesLayer({ archetype }: { archetype: Archetype<GameEntity, ['projectile']> }): React.ReactElement {
  const projectiles = useArchetypeEntities<ProjectileEntity>(archetype);
  return (
    <>
      {projectiles.map((projectile) => (
        <ProjectileObject key={projectile.id} entity={projectile} />
      ))}
    </>
  );
}

function TurretsLayer({ archetype }: { archetype: Archetype<GameEntity, ['turret']> }): React.ReactElement {
  const turrets = useArchetypeEntities<TurretEntity>(archetype);
  return (
    <>
      {turrets.map((e) => (
        <TurretObject key={e.id} entity={e} />
      ))}
    </>
  );
}

function StarsField(): React.ReactElement {
  return (
    <group>
      <points position={[0, 0, 0]}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[STAR_POSITIONS, 3]}
          />
        </bufferGeometry>
        <pointsMaterial color="#ffffff" size={0.3} sizeAttenuation depthWrite={false} />
      </points>
    </group>
  );
}

const STAR_POSITIONS = (() => {
  const positions: number[] = [];
  const spread = WORLD_SIZE * 0.9;
  const rng = new SeededRng(2024);
  for (let i = 0; i < 1500; i += 1) {
    const x = (rng.next() - 0.5) * spread;
    const y = rng.next() * (WORLD_SIZE * 0.4) + 40;
    const z = (rng.next() - 0.5) * spread;
    positions.push(x, y, z);
  }
  return new Float32Array(positions);
})();
