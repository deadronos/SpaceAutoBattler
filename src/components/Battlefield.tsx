import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import { AxesHelper, Color, NoToneMapping, SRGBColorSpace } from 'three';
import { Suspense } from 'react';
import type { Archetype } from 'miniplex';
import type React from 'react';
import type { GameEntity, ProjectileEntity, ShipEntity, TurretEntity } from '../types/index.js';
import { useGameState, useOptionalGameState } from '../game/context.js';
import { updateGame } from '../game/systems.js';
import { useArchetypeEntities } from '../hooks/useArchetypeEntities.js';
import { ShipObject } from './Ship.js';
import { TurretObject } from './Turret.js';
import { ProjectileObject } from './Projectile.js';
import { ParticleTrails } from './ParticleTrails.js';
import { CelestialEnvironment } from './environment/CelestialEnvironment.js';
import { SeededRng } from '../utils/rng.js';
import { CAMERA_DEFAULTS, FOG_DEFAULTS, WORLD_SIZE } from '../game/config.js';
import { useUiStore } from '../game/uiStore.js';
import { BloomProvider } from '../renderer/BloomProvider.js';
import PostprocessingLazy from './PostprocessingLazy.js';
import { HudOverlayCollector } from './HudOverlayCollector.js';

export function Battlefield(): React.ReactElement {
  const state = useOptionalGameState();
  const ppEnabled = useUiStore((s) => s.postprocessingEnabled);

  if (!state) { 
    return <div className="loading-overlay">Preparing simulation…</div>;
  }

  return (
    <Canvas
      shadows
      camera={{ position: [...CAMERA_DEFAULTS.position], fov: CAMERA_DEFAULTS.fov, near: CAMERA_DEFAULTS.near, far: CAMERA_DEFAULTS.far }}
      dpr={[1, 2]}
      onCreated={({ gl }) => {
        gl.outputColorSpace = SRGBColorSpace;
        gl.toneMapping = NoToneMapping;
        gl.toneMappingExposure = 1;
      }}
    >
      <StarsField />
      {ppEnabled ? (
        <BloomProvider enabled>
          <fog attach="fog" args={FOG_DEFAULTS} />
          <CelestialEnvironment />
          <Suspense fallback={null}>
            <ShipsLayer archetype={state.queries.ships} />
            <TurretsLayer archetype={state.queries.turrets} />
            <ProjectilesLayer archetype={state.queries.projectiles} />
          </Suspense>
          {/* Postprocessing (selective bloom + FXAA) */}
          <PostprocessingLazy />
          <BattlefieldSystems />
          <HudOverlayCollector />
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
            transparent
          />
          <primitive object={new AxesHelper(200)} position={[0, 0, 0]} />
        </BloomProvider>
      ) : (
        <>
          <fog attach="fog" args={FOG_DEFAULTS} />
          <CelestialEnvironment />
          <Suspense fallback={null}>
            <ShipsLayer archetype={state.queries.ships} />
            <TurretsLayer archetype={state.queries.turrets} />
            <ProjectilesLayer archetype={state.queries.projectiles} />
          </Suspense>
          <BattlefieldSystems />
          <HudOverlayCollector />
          {/* Drei helpers for navigation and orientation */}
          <OrbitControls enableDamping makeDefault target={[0, 0, 0]} maxDistance={WORLD_SIZE * 2} minDistance={10} />
          {/* Replace manual gridHelper with @react-three/drei Grid for performance and features */}
          {/*fadeDistance={WORLD_SIZE}*/}
          <Grid
            args={[WORLD_SIZE, WORLD_SIZE]}
            cellSize={50}
            sectionSize={500}
            cellColor="#203050"
            sectionColor="#101725"
            position={[0, -5, 0]}
            transparent
            opacity={0.1}
          />
          <primitive object={new AxesHelper(200)} position={[0, 0, 0]} />
        </>
      )}
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

    if (paused) {
      state.simulation.alpha = 0;
      return;
    }
    const sim = state.simulation;
    const step = sim.step;
    const maxSteps = Math.max(1, sim.maxSubSteps);
    const scaled = Math.max(0, delta * Math.max(timeScale, 0));

    if (step <= 0) {
      updateGame(state, scaled);
      sim.alpha = 0;
      return;
    }

    // Prevent unbounded accumulation by clamping to a few steps worth of time.
    const maxAccum = step * maxSteps;
    sim.accumulator = Math.min(sim.accumulator + Math.min(scaled, maxAccum), maxAccum);

    // Keep Rapier step aligned with the fixed time step when available.
    try {
      const params = (state.physicsWorld as any).integrationParameters;
      if (params && typeof params.dt === 'number') {
        params.dt = step;
      }
    } catch {
      /* ignore */
    }

    let steps = 0;
    while (sim.accumulator >= step && steps < maxSteps) {
      updateGame(state, step);
      sim.accumulator -= step;
      steps += 1;
    }

    sim.alpha = step > 0 ? Math.min(sim.accumulator / step, 1) : 0;
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
      <ParticleTrails ships={ships} />
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
          <bufferAttribute attach="attributes-position" args={[STAR_POSITIONS, 3]} />
        </bufferGeometry>
        <pointsMaterial color="#ffffff" size={0.9} sizeAttenuation depthWrite={false} />
      </points>
    </group>
  );
}

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
